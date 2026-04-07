"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Loader2, FileText, Lightbulb, Heart, BookOpen, History, 
  Search, Link as LinkIcon, ExternalLink, 
  Eye, Monitor, Download, X
} from 'lucide-react';
// Note: GeneratedScript component exists in the project but is not used in this detailed view
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { ApiService, GenerationParams, GeneratedScriptData } from '@/services/api';

// Format script text: *** becomes <hr/>, *word* becomes <strong>word</strong>
function formatScript(text: string): React.ReactNode[] {
  if (!text) return [];
  
  const nodes: React.ReactNode[] = [];
  
  // First, split by triple asterisks (***) to create sections separated by <hr/>
  const sections = text.split(/\*\*\*/);
  
  sections.forEach((section, sectionIndex) => {
    if (!section) {
      // Empty section, just add an hr (will happen between consecutive ***)
      if (sectionIndex < sections.length - 1) {
        nodes.push(<hr key={`hr-${sectionIndex}`} className="my-4 border-gray-300" />);
      }
      return;
    }
    
    // Process each section for single asterisk patterns (*word* -> <strong>word</strong>)
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let keyCounter = 0;
    
    // Match *word* pattern (but not *** since we already split on that)
    // Pattern: * followed by one or more non-asterisk characters, followed by *
    const singleAsteriskRegex = /\*([^*\n]+?)\*/g;
    let match: RegExpExecArray | null;
    
    while ((match = singleAsteriskRegex.exec(section)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        const beforeText = section.slice(lastIndex, match.index);
        if (beforeText) {
          // Preserve newlines in the text
          const lines = beforeText.split('\n');
          lines.forEach((line, lineIdx) => {
            if (line) parts.push(line);
            if (lineIdx < lines.length - 1) {
              parts.push(<br key={`br-${sectionIndex}-${keyCounter++}`} />);
            }
          });
        }
      }
      
      // Add the bold text (content between single asterisks)
      parts.push(
        <strong key={`strong-${sectionIndex}-${keyCounter++}`}>
          {match[1]}
        </strong>
      );
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text after last match
    if (lastIndex < section.length) {
      const afterText = section.slice(lastIndex);
      if (afterText) {
        // Preserve newlines
        const lines = afterText.split('\n');
        lines.forEach((line, lineIdx) => {
          if (line) parts.push(line);
          if (lineIdx < lines.length - 1) {
            parts.push(<br key={`br-${sectionIndex}-${keyCounter++}`} />);
          }
        });
      }
    }
    
    // If no matches, add the whole section as-is (with preserved newlines)
    if (parts.length === 0) {
      const lines = section.split('\n');
      lines.forEach((line, lineIdx) => {
        if (line) parts.push(line);
        if (lineIdx < lines.length - 1) {
          parts.push(<br key={`br-${sectionIndex}-${keyCounter++}`} />);
        }
      });
    }
    
    // Add this section's content
    if (parts.length > 0) {
      nodes.push(
        <span key={`section-${sectionIndex}`} className="whitespace-pre-wrap">
          {parts}
        </span>
      );
    }
    
    // Add <hr/> between sections (but not after the last section)
    if (sectionIndex < sections.length - 1) {
      nodes.push(<hr key={`hr-${sectionIndex}`} className="my-4 border-gray-300" />);
    }
  });
  
  return nodes;
}

// Helper function to generate a localStorage key from topic/idea
function getStorageKey(topic?: string, ideaTitle?: string): string {
  const identifier = ideaTitle || topic || 'default';
  // Create a safe key by replacing special characters
  const safeKey = identifier.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  return `script_${safeKey}`;
}

// Cache interface for stored script data
interface CachedScriptData {
  data: GeneratedScriptData;
  params: GenerationParams;
  timestamp: number;
  pageTitle?: string;
}

// Cache duration: 24 hours
const CACHE_DURATION = 24 * 60 * 60 * 1000;

// Save script to localStorage
function saveScriptToStorage(topic: string | undefined, ideaTitle: string | undefined, data: GeneratedScriptData, params: GenerationParams, pageTitle?: string): void {
  try {
    const key = getStorageKey(topic, ideaTitle);
    const cacheData: CachedScriptData = {
      data,
      params,
      timestamp: Date.now(),
      pageTitle,
    };
    localStorage.setItem(key, JSON.stringify(cacheData));
    
    // Also store a reference to the latest script for quick access
    localStorage.setItem('script_latest_key', key);
  } catch (error) {
    console.warn('Failed to save script to localStorage:', error);
    // If localStorage is full, try to clean up old entries
    try {
      const keys = Object.keys(localStorage);
      const scriptKeys = keys.filter(k => k.startsWith('script_') && k !== 'script_latest_key');
      if (scriptKeys.length > 10) {
        // Remove oldest entries
        const sortedKeys = scriptKeys.sort((a, b) => {
          try {
            const dataA = JSON.parse(localStorage.getItem(a) || '{}') as CachedScriptData;
            const dataB = JSON.parse(localStorage.getItem(b) || '{}') as CachedScriptData;
            return (dataA.timestamp || 0) - (dataB.timestamp || 0);
          } catch {
            return 0;
          }
        });
        sortedKeys.slice(0, scriptKeys.length - 10).forEach(k => localStorage.removeItem(k));
      }
      // Retry saving
      const key = getStorageKey(topic, ideaTitle);
      const cacheData: CachedScriptData = {
        data,
        params,
        timestamp: Date.now(),
        pageTitle,
      };
      localStorage.setItem(key, JSON.stringify(cacheData));
      localStorage.setItem('script_latest_key', key);
    } catch {
      console.warn('Failed to cleanup and save script to localStorage');
    }
  }
}

// Load script from localStorage - only returns exact matches, no fallback to latest
function loadScriptFromStorage(topic?: string, ideaTitle?: string): CachedScriptData | null {
  try {
    // Try specific key only - no fallback to latest script to avoid loading wrong topic
    const specificKey = getStorageKey(topic, ideaTitle);
    const specificData = localStorage.getItem(specificKey);
    if (specificData) {
      const cached = JSON.parse(specificData) as CachedScriptData;
      const now = Date.now();
      if (cached.timestamp && now - cached.timestamp < CACHE_DURATION) {
        // Double-check that cached params match what we're looking for
        if (cached.params.topic === topic && cached.params.ideaTitle === ideaTitle) {
          return cached;
        } else {
          // Mismatch - remove invalid cache
          localStorage.removeItem(specificKey);
        }
      } else {
        // Cache expired, remove it
        localStorage.removeItem(specificKey);
      }
    }
    
    return null;
  } catch (error) {
    console.warn('Failed to load script from localStorage:', error);
    return null;
  }
}

export default function ScriptPage() {
  const router = useRouter();
  const [data, setData] = useState<GeneratedScriptData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shouldRender, setShouldRender] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [pageTitle, setPageTitle] = useState('Generated Script');
  const [isTranslating, setIsTranslating] = useState(false);
  
  useEffect(() => {
    const token = localStorage.getItem('sb-xncfghdikiqknuruurfh-auth-token');
    if (!token) {
      setIsRedirecting(true);
      router.push('/auth');
      return;
    }
    
    // Validate token structure before proceeding
    try {
      const parsedToken = JSON.parse(token);
      if (!parsedToken.access_token) {
        // Invalid token structure, redirect immediately
        setIsRedirecting(true);
        localStorage.removeItem('sb-xncfghdikiqknuruurfh-auth-token');
        router.push('/auth');
        return;
      }
    } catch {
      // Invalid token format, redirect immediately
      setIsRedirecting(true);
      localStorage.removeItem('sb-xncfghdikiqknuruurfh-auth-token');
      router.push('/auth');
      return;
    }

    setShouldRender(true);

    const run = async () => {
      setIsLoading(true);
      setError(null);

      let paramsJson: string | null = null;
      let params: GenerationParams | null = null;
      
      // Check if we have fresh params from "Generate Script" button (in sessionStorage)
      try {
        paramsJson = sessionStorage.getItem('generate_params');
        if (paramsJson) {
          try {
            params = JSON.parse(paramsJson);
          } catch {
            // Invalid params, will handle below
          }
        }
      } catch (e) {
        console.warn('Error reading sessionStorage:', e);
      }

      // If we have fresh params from "Generate Script" button, ALWAYS generate new script
      // Don't load from cache - this is a new generation request
      if (paramsJson && params) {
        // Skip cache check - generate new script
        // Continue to generation logic below
      } else {
        // No fresh params - this is a page reload, try loading from localStorage
        try {
          // Check URL params for topic-based loading
          const search = window.location.search;
          const urlParams = new URLSearchParams(search);
          if (urlParams.has('topic')) {
            const topic = urlParams.get('topic') || undefined;
            const cached = loadScriptFromStorage(topic, undefined);
            if (cached) {
              // Verify the cached script matches the topic
              if (cached.params.topic === topic) {
                setData(cached.data);
                if (cached.pageTitle) {
                  setPageTitle(cached.pageTitle);
                }
                setIsLoading(false);
                return; // Successfully loaded from cache
              }
            }
          }
          
          // As last resort, try loading latest script only if sessionStorage is empty
          // This handles the case where user reloads the page after sessionStorage was cleared
          const latestKey = localStorage.getItem('script_latest_key');
          if (latestKey) {
            const latestData = localStorage.getItem(latestKey);
            if (latestData) {
              const cached = JSON.parse(latestData) as CachedScriptData;
              const now = Date.now();
              if (cached.timestamp && now - cached.timestamp < CACHE_DURATION) {
                setData(cached.data);
                if (cached.pageTitle) {
                  setPageTitle(cached.pageTitle);
                }
                setIsLoading(false);
                return; // Successfully loaded latest script
              }
            }
          }
        } catch (e) {
          console.warn('Error checking localStorage:', e);
        }
      }

      // If not found in localStorage or we have fresh params, generate new script
      if (!paramsJson) {
        // Also try reading from URL query (for older flows like /script/:id?duration=...)
        const search = window.location.search;
        const urlParams = new URLSearchParams(search);
        if (urlParams.has('topic') || urlParams.has('duration')) {
          const topic = urlParams.get('topic') || undefined;
          const duration = urlParams.get('duration') || undefined;
          const payload: GenerationParams = {
            topic: topic,
            duration_minutes: duration ? parseInt(duration) : undefined
          };
          // show summary immediately
          try {
            const json = await ApiService.generateScript(payload);
console.log("📦 Script API Response (URL params):", json);
            const scriptTitle = json.title || topic || 'Generated Script';
            // Save to localStorage for future reloads
            saveScriptToStorage(payload.topic, payload.ideaTitle, json as GeneratedScriptData, payload, scriptTitle);
            setData(json as GeneratedScriptData);
            setPageTitle(scriptTitle);
            setIsLoading(false);
            return;
          } catch (err) {
            const error = err as Error;
            // Handle unauthorized errors immediately - redirect without showing error
            if (error.message.includes('Unauthorized') || error.message.includes('Not authenticated')) {
              setIsRedirecting(true);
              localStorage.removeItem('sb-xncfghdikiqknuruurfh-auth-token');
              router.push('/auth');
              return;
            }
            console.error('Failed to generate script from URL params:', error);
            setError(error.message || 'Failed to generate script from URL params');
            setIsLoading(false);
            return;
          }
        }

        // If we reach here, no cached script was found and no params available
        // This should only happen on first visit or if cache expired
        setError('No generation parameters found. Please go back and create a script from a topic.');
        setIsLoading(false);
        return;
      }

      if (!params) {
        try {
          params = JSON.parse(paramsJson);
        } catch {
          setError('Invalid generation parameters.');
          setIsLoading(false);
          return;
        }
      }

      // At this point, params is guaranteed to be non-null
      if (!params) {
        setError('Invalid generation parameters.');
        setIsLoading(false);
        return;
      }

      if (params.ideaTitle) {
        setPageTitle(params.ideaTitle);
      }

      try {
        const json = await ApiService.generateScript(params);
console.log("📦 Script API Response:", json);
        // Use the title from response if available, otherwise use ideaTitle or topic
        const scriptTitle = json.title || params.ideaTitle || params.topic || 'Generated Script';
        // Save to localStorage for future reloads
        saveScriptToStorage(params.topic, params.ideaTitle, json as GeneratedScriptData, params, scriptTitle);
        setData(json as GeneratedScriptData);
        setPageTitle(scriptTitle);
        // optionally clear params so reload won't re-run (but we keep localStorage for reloads)
        try {
          sessionStorage.removeItem('generate_params');
        } catch {
          // Ignore sessionStorage errors
        }
      } catch (err) {
        const error = err as Error;
        // Handle unauthorized errors immediately - redirect without showing error state
        if (error.message.includes('Unauthorized') || error.message.includes('Not authenticated')) {
          setIsRedirecting(true);
          localStorage.removeItem('sb-xncfghdikiqknuruurfh-auth-token');
          router.push('/auth');
          return;
        }
        if (error.message.includes('Insufficient credits')) {
          router.push('/pricing');
          return;
        }
        console.error('Failed to generate script:', error);
        setError(error.message || 'Failed to generate script');
      } finally {
        setIsLoading(false);
      }
    };
    run();
  }, [router]);

  const [showSourcesDialog, setShowSourcesDialog] = useState(false);

  // Prevent body scroll when side panel is open
  useEffect(() => {
    if (showSourcesDialog) {
      // Save current scroll position
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
      
      return () => {
        // Restore scroll position when closing
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [showSourcesDialog]);


  /* ---------------- DOWNLOAD PDF ---------------- */

  const handleDownload = async () => {
    const element = document.getElementById("script-content");
  
    if (!element) {
      alert("No script content found.");
      return;
    }
  
    // ✅ Dynamic import (only runs in browser)
    const html2pdf = (await import("html2pdf.js")).default;
  
    const opt = {
      margin: 0.5,
      filename: `${data?.title || "script"}.pdf`,
      image: { type: "jpeg" as const, quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: "in", format: "a4", orientation: "portrait" as const },
    };
  
    html2pdf().set(opt).from(element).save();
  };
   /* ---------------- TRANSLATE ---------------- */

   const handleTranslate = async () => {
    if (!data) return;

    setIsTranslating(true);

    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: data.script }),
    });

    const json = await res.json();

    setData((prev) =>
      prev ? { ...prev, script: json.translated } : prev
    );

    setIsTranslating(false);
  };

  /* ---------------- TELEPROMPTER ---------------- */

  const handleTeleprompter = () => {
    if (!data) return;
    sessionStorage.setItem("teleprompter_script", data.script || "");
    router.push("/teleprompter");
  };

  if (isLoading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f7]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="animate-spin w-7 h-7 text-[#1d1d1f]" />
          <p className="text-sm text-[#6e6e73] font-light">Generating your script…</p>
        </div>
      </div>
    );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f7]">
      <div className="text-center">
        <p className="text-red-500 mb-4 text-sm">{error}</p>
        <button onClick={() => window.history.back()} className="text-sm text-[#1d1d1f] underline">Go back</button>
      </div>
    </div>
  );
  if (!data) return null;

  const structure = data.structure ?? [];

  // Don't render anything if redirecting or not yet validated
  if (!shouldRender || isRedirecting) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#E9EBF0]/20">
        <Header />
        <main className="container mx-auto px-4 py-8 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-lg">Generating your script...</p>
            <p className="text-gray-600">This may take up to a couple minutes</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#E9EBF0]/20">
        <Header />
        <main className="container mx-auto px-4 py-8 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <p className="text-red-600">{error}</p>
            <Button onClick={() => router.back()} variant="outline">Go Back</Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#E9EBF0]/20">
        <Header />
        <main className="container mx-auto px-4 py-8 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <p className="text-lg">No script data available. Please try generating a new script.</p>
            <Button onClick={() => router.push('/')}>Go Home</Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const metrics = [
    { icon: FileText,  label: 'Total Words',     value: data.metrics?.totalWords ?? data.estimated_word_count ?? 0 },
    { icon: Heart,     label: 'Emotional Depth', value: data.metrics?.emotionalDepth ?? data.analysis?.emotional_depth ?? '—' },
    { icon: Lightbulb, label: 'Examples',        value: data.metrics?.generalExamples ?? data.analysis?.examples_count ?? 0 },
    { icon: BookOpen,  label: 'Proverbs',        value: data.metrics?.proverbs ?? 0 },
    { icon: History,   label: 'Hist. Facts',     value: data.metrics?.historicalFacts ?? 0 },
    { icon: Search,    label: 'Research Facts',  value: data.metrics?.researchFacts ?? data.analysis?.research_facts_count ?? 0 },
  ];

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <Header />

      {showSourcesDialog && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity duration-300"
          onClick={() => setShowSourcesDialog(false)}
          aria-hidden="true"
        />
      )}

      <main className={`max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-10 py-6 transition-all duration-300 ${showSourcesDialog ? 'blur-sm' : ''}`}>

        {/* Page title */}
        <div className="mb-5">
          <h1
            className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1d1d1f] mb-1 break-words"
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}
          >
            {data.title || pageTitle}
          </h1>
          <p className="text-sm text-[#6e6e73] font-light">Research-backed script · ready to record</p>
        </div>

        {/* Metrics strip */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-5">
          {metrics.map(({ icon: Icon, label, value }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-200/80 p-3 text-center shadow-sm">
              <Icon className="w-4 h-4 mx-auto mb-1.5 text-[#6e6e73]" />
              <div className="text-base font-bold text-[#1d1d1f]">{value}</div>
              <div className="text-[10px] text-[#6e6e73] font-light leading-tight">{label}</div>
            </div>
          ))}
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">

          {/* Sidebar — Structure */}
          <div className="lg:col-span-1 order-2 lg:order-1">
            <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm h-[calc(100vh-14rem)] flex flex-col overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex-shrink-0">
                <h2 className="text-sm font-semibold text-[#1d1d1f]">Script Structure</h2>
                <p className="text-[11px] text-[#6e6e73] font-light mt-0.5">Flow & section breakdown</p>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-3">
                {structure.length > 0 ? (
                  <div className="space-y-2">
                    {structure.map((section, index) => (
                      <div key={section.id ?? index} className="flex items-start gap-3">
                        <div className="flex flex-col items-center flex-shrink-0">
                          <div className="w-6 h-6 rounded-full bg-[#1d1d1f] text-white flex items-center justify-center text-[10px] font-semibold">{index + 1}</div>
                          {index < data.structure!.length - 1 && <div className="w-px bg-gray-200 flex-1 mt-1 min-h-[10px]" />}
                        </div>
                        <div className="flex-1 bg-[#f5f5f7] rounded-xl px-3 py-2 border border-gray-100 min-w-0 mb-2">
                          <p className="font-medium text-xs text-[#1d1d1f] break-words">{section.title}</p>
                          <p className="text-[10px] text-[#6e6e73] mt-0.5 font-light">{section.duration} · {section.words ?? '—'} words</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center py-10">
                    <History className="w-8 h-8 text-gray-300 mb-2" />
                    <p className="text-xs text-[#6e6e73]">No structure data</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Main — Script */}
          <div className="lg:col-span-3 order-1 lg:order-2">
            <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm h-[calc(100vh-14rem)] flex flex-col overflow-hidden">

              {/* Toolbar */}
              <div className="px-5 py-3.5 border-b border-gray-100 flex-shrink-0 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm font-semibold text-[#1d1d1f]">Script</h2>
                  <p className="text-[11px] text-[#6e6e73] font-light">Full script with research &amp; structure</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setShowSourcesDialog(true)}
                    className="flex items-center gap-1.5 text-[11px] font-medium text-[#1d1d1f] bg-[#f5f5f7] hover:bg-gray-200 border border-gray-200 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <LinkIcon className="w-3.5 h-3.5" />
                    Sources
                  </button>
                  <button
                    onClick={handleTranslate}
                    disabled={isTranslating}
                    className="flex items-center gap-1.5 text-[11px] font-medium text-[#1d1d1f] bg-[#f5f5f7] hover:bg-gray-200 border border-gray-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isTranslating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    Translate
                  </button>
                  <button
                    onClick={handleTeleprompter}
                    className="flex items-center gap-1.5 text-[11px] font-medium text-[#1d1d1f] bg-[#f5f5f7] hover:bg-gray-200 border border-gray-200 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    Teleprompter
                  </button>
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-1.5 text-[11px] font-medium text-white bg-[#1d1d1f] hover:bg-black px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </button>
                </div>
              </div>

              {/* Script content */}
              <div className="flex-1 overflow-y-auto">
                <div id="script-content" className="px-6 sm:px-8 py-6">
                  <div
                    className="text-[#1d1d1f] leading-[1.9] text-[15px] sm:text-base max-w-3xl mx-auto"
                    style={{ fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
                  >
                    {formatScript(data.synopsis || data.script || 'No synopsis available.')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />

      {/* Sources Side Panel */}
      <div className={`fixed top-0 right-0 h-full w-full sm:w-[400px] bg-white border-l border-gray-200 shadow-2xl z-50 transition-transform duration-300 ease-in-out ${showSourcesDialog ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#1d1d1f]">{data.source_urls?.length || 0} Sources</h2>
            <p className="text-[11px] text-[#6e6e73] font-light">Research references used in this script</p>
          </div>
          <button onClick={() => setShowSourcesDialog(false)} className="w-8 h-8 rounded-full bg-[#f5f5f7] hover:bg-gray-200 flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-[#1d1d1f]" />
          </button>
        </div>
        <ScrollArea className="h-[calc(100vh-73px)]">
          <div className="px-4 py-4 space-y-3">
            {data.source_urls && data.source_urls.length > 0 ? (
              data.source_urls.map((url, index) => {
                let domain = '';
                let domainInitial = '?';
                try {
                  if (url) {
                    domain = new URL(url).hostname.replace('www.', '');
                    domainInitial = domain.charAt(0).toUpperCase();
                  }
                } catch {
                  domain = url || 'Unknown source';
                  domainInitial = domain.charAt(0).toUpperCase();
                }
                return (
                  <a key={index} href={url} target="_blank" rel="noopener noreferrer"
                    className="flex items-start gap-3 bg-[#f5f5f7] hover:bg-gray-100 rounded-2xl p-4 transition-colors group border border-gray-100"
                  >
                    <div className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-[#1d1d1f] font-semibold text-sm flex-shrink-0 shadow-sm">
                      {domainInitial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-[#6e6e73] mb-0.5 font-light">{domain}</p>
                      <p className="text-xs font-medium text-[#1d1d1f] line-clamp-2 group-hover:text-blue-600 transition-colors break-all">{url}</p>
                      <div className="flex items-center gap-1 mt-1.5 text-[10px] text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        Visit source <ExternalLink className="w-3 h-3" />
                      </div>
                    </div>
                  </a>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <LinkIcon className="w-10 h-10 text-gray-200 mb-3" />
                <p className="text-sm text-[#6e6e73]">No sources available</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
