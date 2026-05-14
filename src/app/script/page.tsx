"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2, FileText, Lightbulb, Heart, BookOpen, History,
  Search, Link as LinkIcon, ExternalLink,
  Eye, Monitor, Download, X, Lock, Unlock, AlertCircle
} from 'lucide-react';
// Note: GeneratedScript component exists in the project but is not used in this detailed view
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { ApiService, GenerationParams, GeneratedScriptData } from '@/services/api';
import { supabase } from '@/lib/supabaseClient';


type HashtagItem = {
  hashtag: string;
  strategy: 'expansion' | 'established';
};

// Unwrap JSON envelope if backend returned {"script": "..."} as raw string
function unwrapScriptJson(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{')) return trimmed;
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed.script === 'string') return parsed.script;
  } catch {
    const m = trimmed.match(/"script"\s*:\s*"([\s\S]*)"/);
    if (m) return m[1].replace(/\\"/g, '"').replace(/\\n/g, '\n');
  }
  return trimmed;
}

// Format script text: *** becomes <hr/>, *word* becomes <strong>word</strong>, \n\n becomes paragraphs
function formatScript(text: string): React.ReactNode[] {
  if (!text) return [];

  const scriptText = unwrapScriptJson(text);
  const nodes: React.ReactNode[] = [];

  const sections = scriptText.split(/\*\*\*/);

  sections.forEach((section, sectionIndex) => {
    const paragraphs = section.split(/\n\n+/).map(p => p.trim()).filter(Boolean);

    paragraphs.forEach((para, paraIndex) => {
      const parts: React.ReactNode[] = [];
      const boldRegex = /\*([^*\n]+?)\*/g;
      let lastIndex = 0;
      let keyCounter = 0;
      let match: RegExpExecArray | null;

      while ((match = boldRegex.exec(para)) !== null) {
        if (match.index > lastIndex) parts.push(para.slice(lastIndex, match.index));
        parts.push(<strong key={`b-${sectionIndex}-${paraIndex}-${keyCounter++}`}>{match[1]}</strong>);
        lastIndex = match.index + match[0].length;
      }
      if (lastIndex < para.length) parts.push(para.slice(lastIndex));

      nodes.push(
        <p key={`p-${sectionIndex}-${paraIndex}`} className="mb-5">
          {parts.length > 0 ? parts : para}
        </p>
      );
    });

    if (sectionIndex < sections.length - 1) {
      nodes.push(<hr key={`hr-${sectionIndex}`} className="my-6 border-gray-200" />);
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
  const hasCalledRef = React.useRef(false);

  // Refs that stay current for use inside event handlers / cleanup
  const dataRef              = React.useRef<GeneratedScriptData | null>(null);
  const isUnlockedRef        = React.useRef(false);
  const scriptSavedRef       = React.useRef(false);
  const scriptDurationRef    = React.useRef<number | undefined>(undefined);
  const scriptTopicRef       = React.useRef<string | undefined>(undefined);
  const pageTitleRef         = React.useRef('Generated Script');
  // ID of the scripts_universal row (set when loaded via ?scriptId= from that table)
  const universalScriptIdRef = React.useRef<string | null>(null);

 

  
  useEffect(() => {
    if (hasCalledRef.current) return; // ✅ prevents double call
    hasCalledRef.current = true;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsRedirecting(true);
        router.push('/auth');
        return;
      }

      setShouldRender(true);

    const run = async () => {
      const userId = session.user.id;
      setIsLoading(true);
      setError(null);

      // ── Load by scriptId ────────────────────────────────────────────────────
      const urlSearchParams = new URLSearchParams(window.location.search);
      const scriptId = urlSearchParams.get('scriptId');
      if (scriptId) {
        // 1. Try user's unlocked scripts table (show fully unlocked)
        const { data: row } = await supabase
          .from('scripts_assigned')
          .select('id, title, topic, script, estimated_word_count, source_urls, analysis, structure, seo, duration')
          .eq('id', scriptId)
          .single();

        if (row) {
          const normalized: GeneratedScriptData = {
            script:               row.script ?? '',
            estimated_word_count: row.estimated_word_count ?? 0,
            source_urls:          (row.source_urls as string[]) ?? [],
            analysis:             row.analysis ?? { examples_count: 0, research_facts_count: 0, proverbs_count: 0, emotional_depth: '', history: 0 },
            title:                row.title ?? row.topic ?? 'Script',
            structure:            row.structure ?? [],
            seo:                  row.seo ?? {},
          };
          setData(normalized);
          setPageTitle(row.title || row.topic || 'Script');
          setScriptTopic(row.topic ?? undefined);
          setScriptDuration(row.duration ?? undefined);
          setIsUnlocked(true);
          setScriptSaved(true);
          setIsLoading(false);
          return;
        }

        // 2. Try scripts_universal (show locked — user must unlock to save to their account)
        const { data: uRow, error: uErr } = await supabase
          .from('scripts_universal')
          .select('id, title, topic, script, estimated_word_count, source_urls, analysis, structure, seo, duration')
          .eq('id', scriptId)
          .single();

        if (uErr || !uRow) {
          setError('Script not found.');
          setIsLoading(false);
          return;
        }

        const uNormalized: GeneratedScriptData = {
          script:               uRow.script ?? '',
          estimated_word_count: uRow.estimated_word_count ?? 0,
          source_urls:          (uRow.source_urls as string[]) ?? [],
          analysis:             uRow.analysis ?? { examples_count: 0, research_facts_count: 0, proverbs_count: 0, emotional_depth: '', history: 0 },
          title:                uRow.title ?? uRow.topic ?? 'Script',
          structure:            uRow.structure ?? [],
          seo:                  uRow.seo ?? {},
        };
        setData(uNormalized);
        setPageTitle(uRow.title || uRow.topic || 'Script');
        setScriptTopic(uRow.topic ?? undefined);
        setScriptDuration(uRow.duration ?? undefined);
        universalScriptIdRef.current = uRow.id; // remember for delete-on-unlock
        setIsLoading(false);
        return;
      }
      // ────────────────────────────────────────────────────────────────────────

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
                setScriptDuration(cached.params.duration_minutes);
                setScriptTopic(cached.params.topic);
                if (cached.pageTitle) setPageTitle(cached.pageTitle);
                // Restore unlock state if previously unlocked
                const cacheKey = getStorageKey(topic, undefined);
                if (localStorage.getItem(`${cacheKey}_unlocked`) === 'true') setIsUnlocked(true);
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
                setScriptDuration(cached.params?.duration_minutes);
                setScriptTopic(cached.params?.topic);
                if (cached.pageTitle) setPageTitle(cached.pageTitle);
                // Restore unlock state if previously unlocked
                if (localStorage.getItem(`${latestKey}_unlocked`) === 'true') setIsUnlocked(true);
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
            duration_minutes: duration ? parseInt(duration) : undefined,
            userId: session.user.id,
          };
          // show summary immediately
          try {
            let json;
            try {
              json = await ApiService.generateScript(payload);
            } catch (error: any) {
              if (error.message?.includes('timeout')) {
                console.warn('Timeout ignored (URL params)');
                return; // ✅ ignore timeout
              }
              throw error;
            }
console.log("📦 Script API Response (URL params):", json);

function extractScript(raw: any): string {
  if (!raw) return "";

  if (typeof raw === "object") {
    const s = raw.script || "";
    return typeof s === "string" ? unwrapScriptJson(s) : "";
  }

  if (typeof raw === "string") return unwrapScriptJson(raw);

  return "";
}

const normalized: GeneratedScriptData = {
  ...json,
  script: extractScript(json),
};

const scriptTitle = normalized.title || topic || 'Generated Script';

saveScriptToStorage(payload.topic, payload.ideaTitle, normalized, payload, scriptTitle);

setData(normalized);
            if (payload.duration_minutes) setScriptDuration(payload.duration_minutes);
            if (payload.topic) setScriptTopic(payload.topic);
            setPageTitle(scriptTitle);
            setIsLoading(false);
            return;
          } catch (err) {
            const error = err as Error;
            // Handle unauthorized errors immediately - redirect without showing error
            if (error.message.includes('Unauthorized') || error.message.includes('Not authenticated')) {
              setIsRedirecting(true);
              supabase.auth.signOut();
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
        let json;
try {
  params.userId = session.user.id;
  json = await ApiService.generateScript(params);
} catch (error: any) {
  if (error.message?.includes('timeout')) {
    console.warn('Timeout ignored (main call)');
    return; // ✅ ignore timeout
  }
  throw error;
}
console.log("📦 Script API Response:", json);
        // Use the title from response if available, otherwise use ideaTitle or topic

        function extractScript(raw: any): string {
          if (!raw) return "";
          if (typeof raw === "object") {
            const s = raw.script || "";
            return typeof s === "string" ? unwrapScriptJson(s) : "";
          }
          if (typeof raw === "string") return unwrapScriptJson(raw);
          return "";
        }
        

        const normalized: GeneratedScriptData = {
          ...json,
          script: extractScript(json),
        };
        
        const scriptTitle =
          normalized.title || params.ideaTitle || params.topic || "Generated Script";
        
        saveScriptToStorage(params.topic, params.ideaTitle, normalized, params, scriptTitle);

        setData(normalized);
        setPageTitle(scriptTitle);
        // Capture duration before clearing sessionStorage
        if (params.duration_minutes) setScriptDuration(params.duration_minutes);
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
  })();
  }, [router]);

  const [showSourcesDialog, setShowSourcesDialog] = useState(false);
  const [contentTab, setContentTab] = useState<1|2|3|4|5>(1);

  // ── Feedback state ───────────────────────────────────────────────────────
  const [feedbackRating, setFeedbackRating] = useState<string>('');
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');

  const handleFeedbackSubmit = async () => {
    if (!feedbackRating) return;
    setFeedbackSubmitting(true);
    setFeedbackError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { error } = await supabase.from('Feedback').insert({
        Rating: feedbackRating,
        Comments: feedbackComment.trim() || null,
        Scripts: data?.script ?? null,
        userId: session?.user.id ?? null,
      });
      if (error) throw error;
      setFeedbackSubmitted(true);
    } catch (err: any) {
      setFeedbackError(err?.message || 'Failed to submit feedback. Please try again.');
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  // ── Unlock state ─────────────────────────────────────────────────────────
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [showInsufficientPopup, setShowInsufficientPopup] = useState(false);
  const [scriptDuration, setScriptDuration] = useState<number | undefined>();
  const [scriptTopic, setScriptTopic] = useState<string | undefined>();
  const [scriptSaved, setScriptSaved] = useState(false); // prevent duplicate saves

  // ── Exit feedback (shown when user tries to leave without unlocking) ────────
  const [showExitFeedback, setShowExitFeedback]   = useState(false);
  const [exitRating, setExitRating]               = useState('');
  const [exitComment, setExitComment]             = useState('');
  const [exitSubmitting, setExitSubmitting]       = useState(false);
  const allowExitRef = React.useRef(false);

  // Intercept the browser back button when script is locked
  useEffect(() => {
    if (!data || isUnlocked) return;
    // Push a guard entry so the first back-click doesn't leave immediately
    window.history.pushState(null, '');
    const handlePopState = () => {
      if (isUnlockedRef.current || allowExitRef.current) return;
      window.history.pushState(null, ''); // re-block
      setShowExitFeedback(true);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!data, isUnlocked]);

  const proceedExit = () => {
    allowExitRef.current = true;
    window.history.go(-2); // skip our guard entry + go to previous page
  };

  const handleExitClose = () => {
    setShowExitFeedback(false);
    proceedExit();
  };

  const handleExitSubmit = async () => {
    if (!exitRating) return;
    setExitSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await supabase.from('Feedback_lock').insert({
        userId:  session?.user.id ?? null,
        script:  data?.script     ?? null,
        rating:  exitRating,
        comment: exitComment.trim() || null,
      });
    } catch {
      // fire-and-forget
    } finally {
      setExitSubmitting(false);
      setShowExitFeedback(false);
      proceedExit();
    }
  };

  // Keep refs in sync with state so event handlers always see current values
  useEffect(() => { dataRef.current        = data;          }, [data]);
  useEffect(() => { isUnlockedRef.current  = isUnlocked;    }, [isUnlocked]);
  useEffect(() => { scriptSavedRef.current = scriptSaved;   }, [scriptSaved]);
  useEffect(() => { scriptDurationRef.current = scriptDuration; }, [scriptDuration]);
  useEffect(() => { scriptTopicRef.current    = scriptTopic;    }, [scriptTopic]);
  useEffect(() => { pageTitleRef.current      = pageTitle;      }, [pageTitle]);

  async function generateHash(text: string) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // Helper: POST to scripts_universal using fetch keepalive (safe during page unload)
  const saveToUniversalScripts = React.useCallback(async () => {
    const d = dataRef.current;
    const params = new URLSearchParams(window.location.search);

if (params.get('from') === 'suggested') {
  return;
}
    if (!d || isUnlockedRef.current || scriptSavedRef.current) return;
    const topic = scriptTopicRef.current
      ?? new URLSearchParams(window.location.search).get('topic')
      ?? pageTitleRef.current;
    const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    const supabaseKey  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
    const hash = await generateHash(d.script);
    fetch(
      `${supabaseUrl}/rest/v1/scripts_universal?on_conflict=script_hash`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          script_hash: hash,
          title: d.title || pageTitleRef.current || topic,
          topic: topic,
          script: d.script,
          estimated_word_count: d.estimated_word_count ?? 0,
          duration:      scriptDurationRef.current ?? null,
          source_urls:   d.source_urls   ?? [],
          analysis:      d.analysis      ?? {},
          structure:     d.structure     ?? [],
          seo:           d.seo           ?? {},
          category:      d.category      ?? null,
          subcategories: d.subcategories ?? [],
        }),
        keepalive: true,
      }
    ).catch(() => {});
  }, []);

  // Save on SPA navigation away (component unmount)
  useEffect(() => {
    return () => { saveToUniversalScripts(); };
  }, [saveToUniversalScripts]);

  // Save on tab close / browser refresh (keepalive fetch survives page unload)
  useEffect(() => {
    const handler = () => { saveToUniversalScripts(); };
    window.addEventListener('pagehide', handler);
    return () => window.removeEventListener('pagehide', handler);
  }, [saveToUniversalScripts]);

  const handleUnlock = async () => {
    setIsUnlocking(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/auth'); return; }

      // Use duration captured into state at script-load time
      const duration = scriptDuration;

      const res = await fetch('https://storybit-backend.onrender.com/unlock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ userId: session.user.id, duration }),
      });

      const json = await res.json().catch(() => ({}));

      if (res.ok && json.status !== 'insufficient') {
        setIsUnlocked(true);

        // Persist unlock so page refresh keeps the script visible
        try {
          const key = localStorage.getItem('script_latest_key');
          if (key) localStorage.setItem(`${key}_unlocked`, 'true');
        } catch {}

        // Save script to Supabase scripts table (once only)
        if (!scriptSaved && data) {
          setScriptSaved(true);

          const topic =
            scriptTopic ??
            new URLSearchParams(window.location.search).get("topic") ??
            pageTitle;
        
          // INSERT into scripts table
          const { error: insertError } = await supabase
            .from("scripts_assigned")
            .insert({
              userId: session.user.id,
              title: data.title || pageTitle || topic,
              topic: topic,
              script: data.script,
              estimated_word_count: data.estimated_word_count ?? 0,
              duration: scriptDuration ?? null,
              source_urls: data.source_urls ?? [],
              analysis: data.analysis ?? {},
              structure: data.structure ?? [],
              seo: data.seo ?? {},
              status: "published",
              thumbnail_url: null,
              youtube_url: null,
              views: 0,
              likes: 0,
              is_public: true,
              category:      data.category      ?? null,
              subcategories: data.subcategories ?? [],
            });
        
          if (insertError) {
            console.error("[scripts save]", insertError.message);
            return;
          }
        
          // DELETE from scripts_universal by exact ID (only when script was loaded from there)
          if (universalScriptIdRef.current) {
            const { error: deleteError } = await supabase
              .from('scripts_universal')
              .delete()
              .eq('id', universalScriptIdRef.current);
            if (deleteError) console.error('[scripts_universal delete]', deleteError.message);
            else universalScriptIdRef.current = null;
          }
        }
      } else {
        setShowInsufficientPopup(true);
      }
    } catch (err) {
      console.error('Unlock error:', err);
    } finally {
      setIsUnlocking(false);
    }
  };

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

  // Flatten structure segments from new backend format: structure[].segments[].{ name, percentage }
  const structureSegments = (data.structure ?? []).flatMap(s => s.segments ?? []);

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
    { icon: BookOpen,  label: 'Proverbs',        value: data.analysis?.proverbs_count },
    { icon: History,   label: 'Hist. Facts',     value: data.analysis?.history   },
    { icon: Search,    label: 'Research Facts',  value: data.metrics?.researchFacts ?? data.analysis?.research_facts_count ?? 0 },
  ];

  // ── Content Strategy Panel — driven by seo data from backend ────────────
  const csBase   = data.title || pageTitle;
  // Backend double-nests as seo.seo — resolve the inner object first, fall back to outer
  const seoInner = data.seo?.seo ?? data.seo;

  // ── Tab 1: Title Workshop ─────────────────────────────────────────────────
  const TYPE_META: Record<string, { label: string; dotColor: string; typeColor: string; borderActive: string; bgActive: string }> = {
    curiosity_gap: { label: 'CURIOSITY GAP', dotColor: 'bg-purple-500', typeColor: 'text-purple-700', borderActive: 'border-purple-200', bgActive: 'bg-purple-50' },
    data_led:      { label: 'DATA-LED',      dotColor: 'bg-blue-500',   typeColor: 'text-blue-700',   borderActive: 'border-blue-200',   bgActive: 'bg-blue-50'   },
    how_to:        { label: 'HOW-TO',        dotColor: 'bg-green-500',  typeColor: 'text-green-700',  borderActive: 'border-green-200',  bgActive: 'bg-green-50'  },
    narrative:     { label: 'NARRATIVE',     dotColor: 'bg-orange-500', typeColor: 'text-orange-700', borderActive: 'border-orange-200', bgActive: 'bg-orange-50' },
  };
  const backendTitles = (seoInner as { recommended_titles?: Array<{ type: string; title: string; desc: string; selected?: boolean }> } | undefined)?.recommended_titles;
  const csTitleVariants = (
    backendTitles && backendTitles.length > 0
      ? backendTitles.map(t => ({
          type:         (TYPE_META[t.type]?.label   ?? t.type.replace(/_/g, ' ').toUpperCase()),
          dotColor:     (TYPE_META[t.type]?.dotColor ?? 'bg-gray-500'),
          typeColor:    (TYPE_META[t.type]?.typeColor ?? 'text-gray-700'),
          borderActive: (TYPE_META[t.type]?.borderActive ?? 'border-gray-200'),
          bgActive:     (TYPE_META[t.type]?.bgActive ?? 'bg-gray-50'),
          title:        t.title,
          desc:         t.desc,
          selected:     t.selected ?? false,
        }))
      : [
          { type: 'CURIOSITY GAP', dotColor: 'bg-purple-500', typeColor: 'text-purple-700', borderActive: 'border-purple-200', bgActive: 'bg-purple-50',  title: csBase,                                desc: 'Self-recognition hook creates cognitive dissonance. Signals exclusive information — strong CTR on discovery feeds.', selected: true  },
          { type: 'DATA-LED',      dotColor: 'bg-blue-500',   typeColor: 'text-blue-700',   borderActive: 'border-blue-200',   bgActive: 'bg-blue-50',    title: `The Research Behind: ${csBase}`,       desc: 'Statistic-first builds instant credibility. Appeals to evidence-seeking viewers who have already noticed the problem.', selected: false },
          { type: 'HOW-TO',        dotColor: 'bg-green-500',  typeColor: 'text-green-700',  borderActive: 'border-green-200',  bgActive: 'bg-green-50',   title: `How ${csBase} Works — And What To Do`, desc: 'Mechanism + solution promise in one frame. Captures viewers actively seeking answers, not just understanding.', selected: false },
          { type: 'NARRATIVE',     dotColor: 'bg-orange-500', typeColor: 'text-orange-700', borderActive: 'border-orange-200', bgActive: 'bg-orange-50',  title: `A Deep Dive Into ${csBase}`,           desc: '"Deep dive" signals premium content depth — correlates with strong watch-time retention on long-form viewers.', selected: false },
        ]
  ).map(v => {
    const c = v.title.length;
    return { ...v, chars: c, verdict: c <= 60 ? 'within limit' : c <= 79 ? 'optimal' : 'trim needed', verdictColor: c <= 60 ? 'text-green-600' : c <= 79 ? 'text-green-500' : 'text-amber-500' };
  });

  // ── Tab 2: Keyword Strategy ───────────────────────────────────────────────
  const kc       = (seoInner as { keyword_clusters?: { primary: string[]; secondary: string[]; longtail: string[]; question_based: string[] } } | undefined)?.keyword_clusters;
  const csKws    = data.metrics?.keywords ?? [];
  const csPrimary    = (kc?.primary   ?? []).length > 0 ? (kc?.primary ?? [])   : csKws.slice(0, 2).length > 0 ? csKws.slice(0, 2) : [csBase.toLowerCase().split(' ').slice(0, 3).join(' '), csBase.toLowerCase().split(' ').slice(0, 2).join(' ') + ' explained'];
  const csSecondary  = (kc?.secondary ?? []).length > 0 ? (kc?.secondary ?? []) : csKws.slice(2, 5).length > 0 ? csKws.slice(2, 5) : ['related topic', 'semantic variant', 'alternative angle'];
  const csLongTail   = (kc?.longtail  ?? []).length > 0 ? (kc?.longtail ?? [])  : csKws.length > 0 ? [`why ${csKws[0]} explained`, `${csKws[0]} complete guide`, `how ${csKws[0]} works`, `${csKws[1] ?? csKws[0]} for beginners`] : [`why ${csBase.toLowerCase()} explained`, `${csBase.toLowerCase()} complete guide`, `how ${csBase.toLowerCase()} works`, `${csBase.toLowerCase()} for beginners`];
  const csQuestions  = (kc?.question_based ?? []).length > 0 ? (kc?.question_based ?? []) : [`is ${csKws[0] ?? csBase.toLowerCase()} real?`, `how to understand ${csKws[0] ?? csBase.toLowerCase()}`, `why is ${csKws[0] ?? 'this'} happening?`, `what causes ${csKws[1] ?? csBase.toLowerCase()}?`];

  // ── Tab 4: Description Builder ────────────────────────────────────────────
  const dt = (seoInner as { description_template?: { hook: string; body_bullets: string[]; outro: string } } | undefined)?.description_template;
  const csSynopsisLines = (data.synopsis ?? data.script ?? '').split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 20);
  const csHook    = dt?.hook ?? (csSynopsisLines.slice(0, 2).join('. ') + '.');
  const csBody    = (dt?.body_bullets ?? []).length > 0 ? (dt?.body_bullets ?? []) : csSynopsisLines.slice(2, 7);
  const csOutro   = dt?.outro ?? 'If this changed how you see this topic, subscribe for more research-backed breakdowns every week. Drop your biggest takeaway in the comments — I read every one.';
  const csFirstKw = csKws[0] ?? csPrimary[0] ?? '';

  // ── Tab 5: Hashtag Strategy ───────────────────────────────────────────────
  const seoHashtags: HashtagItem[] = (seoInner?.hashtags ?? []) as HashtagItem[];
  const establishedTags = seoHashtags
  .filter(h => h.strategy === 'established')
  .map(h => h.hashtag);

const expansionTags = seoHashtags
  .filter(h => h.strategy === 'expansion')
  .map(h => h.hashtag);

const csEstablished =
  establishedTags.length > 0
    ? establishedTags
    : ['#content', '#education', '#learning'];

const csExpansion =
  expansionTags.length > 0
    ? expansionTags
    : ['#newcontent', '#trending'];

  // ── Tab 3: Thumbnail Concepts ─────────────────────────────────────────────
  const csThumbnails = (seoInner as { thumbnail_brief?: Array<{ type: string; style: string; headline: string; text_overlay: string; face_recommended: boolean; description: string; preview_image_url?: string }> } | undefined)?.thumbnail_brief ?? [];

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

      <main className={`max-w-screen-8xl mx-auto px-4 sm:px-6 lg:px-10 py-6 transition-all duration-300 ${showSourcesDialog ? 'blur-sm' : ''}`}>

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

        {/* ── Content Strategy Panel ───────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm mb-5 overflow-hidden ">

          {/* Tab navigation */}
          <div className="flex overflow-x-auto border-b border-gray-100 scrollbar-none">
            {([
              [1, 'Title Workshop'],
              [2, 'Keyword Strategy'],
              [3, 'Thumbnail Concepts'],
              [4, 'Description Builder'],
              [5, 'Hashtag Strategy'],
            ] as [number, string][]).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setContentTab(id as 1|2|3|4|5)}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-3 sm:py-3.5 text-xs sm:text-sm whitespace-nowrap font-medium border-b-2 -mb-px transition-colors flex-shrink-0 ${
                  contentTab === id
                    ? 'border-[#1d1d1f] text-[#1d1d1f] font-semibold'
                    : 'border-transparent text-[#6e6e73] hover:text-[#1d1d1f]'
                }`}
              >
                <span className={`w-5 h-5 rounded-full border-[1.5px] flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                  contentTab === id ? 'border-orange-500 text-orange-500' : 'border-gray-300 text-gray-400'
                }`}>{id}</span>
                {label}
              </button>
            ))}
          </div>

          <div className="p-5 overflow-y-scroll h-[300px]">

            {/* ── Tab 1: Title Workshop ── */}
            {contentTab === 1 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 ">
                {csTitleVariants.map((v, i) => (
                  <div key={i} className={`rounded-xl border p-4 transition-all ${v.selected ? `${v.borderActive} ${v.bgActive}` : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/60'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${v.dotColor}`} />
                        <span className={`text-[10px] font-bold tracking-widest uppercase ${v.typeColor}`}>{v.type}</span>
                      </div>
                      {v.selected && (
                        <span className="w-5 h-5 rounded-full bg-[#1d1d1f] flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">✓</span>
                      )}
                    </div>
                    <p className="text-[#1d1d1f] font-bold text-sm leading-snug mb-2">{v.title}</p>
                    <p className={`text-[11px] font-semibold mb-3 ${v.verdictColor}`}>{v.chars} chars · {v.verdict}</p>
                    <p className="text-[11px] text-gray-500 leading-relaxed">{v.desc}</p>
                  </div>
                ))}
              </div>
            )}

            {/* ── Tab 2: Keyword Strategy ── */}
            {contentTab === 2 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* PRIMARY */}
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      <span className="text-[10px] font-bold tracking-widest uppercase text-amber-700">Primary</span>
                    </div>
                    <span className="text-[9px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md">Use in title + first 30s</span>
                  </div>
                  <p className="text-[10px] text-gray-500 mb-3 leading-relaxed">Use in title, spoken in first 30 seconds, and naturally 2–3× throughout the video.</p>
                  <div className="space-y-2">
                    {csPrimary.map((kw, i) => (
                      <div key={i} className="bg-amber-50 border border-amber-300 rounded-lg px-3 py-2 text-sm font-bold text-amber-900 text-center">{kw}</div>
                    ))}
                  </div>
                </div>

                {/* SECONDARY */}
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-purple-500" />
                      <span className="text-[10px] font-bold tracking-widest uppercase text-purple-700">Secondary</span>
                    </div>
                    <span className="text-[9px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md">Weave into body</span>
                  </div>
                  <p className="text-[10px] text-gray-500 mb-3 leading-relaxed">Semantic variants — distribute through script body and YouTube description.</p>
                  <div className="flex flex-wrap gap-2">
                    {csSecondary.map((kw, i) => (
                      <span key={i} className="bg-gray-100 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#1d1d1f]">{kw}</span>
                    ))}
                  </div>
                </div>

                {/* LONG-TAIL */}
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-[10px] font-bold tracking-widest uppercase text-green-700">Long-Tail</span>
                    </div>
                    <span className="text-[9px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md">Low competition</span>
                  </div>
                  <p className="text-[10px] text-gray-500 mb-3 leading-relaxed">High specificity phrases — strong for YouTube search ranking against low-quality incumbents.</p>
                  <div className="space-y-1.5">
                    {csLongTail.map((kw, i) => (
                      <div key={i} className="bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#1d1d1f]">{kw}</div>
                    ))}
                  </div>
                </div>

                {/* QUESTIONS */}
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      <span className="text-[10px] font-bold tracking-widest uppercase text-blue-700">Questions</span>
                    </div>
                    <span className="text-[9px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md">PAA · Answer in script</span>
                  </div>
                  <p className="text-[10px] text-gray-500 mb-3 leading-relaxed">Real questions from &apos;People Also Ask&apos; — answering these directly boosts search relevance.</p>
                  <div className="space-y-1.5">
                    {csQuestions.map((q, i) => (
                      <div key={i} className="bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-blue-900">{q}</div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Tab 3: Thumbnail Concepts ── */}
            {contentTab === 3 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Concept 1: Curiosity Gap */}
                <div className="bg-white border border-gray-200 rounded-xl p-4 flex gap-4">
                  <div
                    className=" w-28 sm:w-44 h-full rounded-xl flex-shrink-0 flex items-center justify-center object-cover"
                    
                  >
                   <img src="https://tse4.mm.bing.net/th/id/OIP.cLbYbv7UTbr2eAgrEEhkwwHaEK?pid=Api&P=0&h=180" alt="Thumbnail 1" className="w-full h-full rounded-xl" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-purple-500" />
                        <span className="text-[10px] font-bold tracking-widest uppercase text-purple-700">Curiosity Gap</span>
                      </div>
                      <span className="text-[9px] bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full font-semibold">Warm</span>
                    </div>
                    <p className="text-sm font-bold text-[#1d1d1f] mb-1.5">Shocked expression + bold text overlay</p>
                    <p className="text-[11px] text-gray-500 leading-relaxed mb-3">Face + emotional text creates immediate empathy. Warm palette mirrors topic energy — shock vs calm headline tension drives clicks.</p>
                    <div className="bg-[#f5f5f7] border border-gray-200 rounded-lg px-3 py-2 mb-2.5">
                      <p className="text-[9px] text-gray-400 uppercase tracking-widest mb-0.5">Text Overlay</p>
                      <p className="text-xs font-bold text-[#1d1d1f]">YOUR BRAIN ON FASHION</p>
                    </div>
                    <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 border border-green-200 text-[10px] px-2 py-0.5 rounded-full font-semibold">✓ Face recommended</span>
                  </div>
                </div>

                {/* Concept 2: Data-Driven */}
                <div className="bg-white border border-gray-200 rounded-xl p-4 flex gap-4">
                <div
                    className="w-28 sm:w-44 h-full rounded-xl flex-shrink-0 flex items-center justify-center object-cover"
                    
                  >
                   <img src="https://tse4.mm.bing.net/th/id/OIP.cLbYbv7UTbr2eAgrEEhkwwHaEK?pid=Api&P=0&h=180" alt="Thumbnail 1" className="w-full h-full rounded-xl" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        <span className="text-[10px] font-bold tracking-widest uppercase text-blue-700">Data-Driven</span>
                      </div>
                      <span className="text-[9px] bg-blue-100 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-full font-semibold">Cool</span>
                    </div>
                    <p className="text-sm font-bold text-[#1d1d1f] mb-1.5">Bold statistic on dark minimal background</p>
                    <p className="text-[11px] text-gray-500 leading-relaxed mb-3">Number-first framing signals credibility and stops the scroll. Cool palette reads analytical — separates from oversaturated thumbnails.</p>
                    <div className="bg-[#f5f5f7] border border-gray-200 rounded-lg px-3 py-2 mb-2.5">
                      <p className="text-[9px] text-gray-400 uppercase tracking-widest mb-0.5">Text Overlay</p>
                      <p className="text-xs font-bold text-[#1d1d1f]">1 IN 3 ARE ADDICTED</p>
                    </div>
                    <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-600 border border-gray-200 text-[10px] px-2 py-0.5 rounded-full font-semibold">No face needed</span>
                  </div>
                </div>
              </div>
            )}

            {/* ── Tab 4: Description Builder ── */}
            {contentTab === 4 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* HOOK */}
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      <span className="text-[10px] font-bold tracking-widest uppercase text-amber-700">Hook</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-gray-400">keyword in first 10 words</span>
                      <button
                        className="text-[9px] bg-gray-100 border border-gray-200 text-gray-600 px-2 py-0.5 rounded-md font-semibold hover:bg-gray-200 transition-colors"
                        onClick={() => navigator.clipboard.writeText(csHook)}
                      >Copy</button>
                    </div>
                  </div>
                  <p className="text-sm text-[#1d1d1f] leading-relaxed">
                    {csFirstKw && csHook.toLowerCase().includes(csFirstKw.toLowerCase())
                      ? csHook.split(new RegExp(`(${csFirstKw})`, 'i')).map((part, i) =>
                          part.toLowerCase() === csFirstKw.toLowerCase()
                            ? <mark key={i} className="bg-amber-200 text-amber-900 rounded px-0.5 not-italic font-semibold">{part}</mark>
                            : part
                        )
                      : csHook || 'No synopsis available.'}
                  </p>
                </div>

                {/* BODY */}
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-[10px] font-bold tracking-widest uppercase text-green-700">Body</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-gray-400">3–5 content bullets</span>
                      <button
                        className="text-[9px] bg-gray-100 border border-gray-200 text-gray-600 px-2 py-0.5 rounded-md font-semibold hover:bg-gray-200 transition-colors"
                        onClick={() => navigator.clipboard.writeText(csBody.map(b => `→ ${b}`).join('\n'))}
                      >Copy</button>
                    </div>
                  </div>
                  <ul className="space-y-2.5">
                    {csBody.length > 0 ? csBody.map((bullet, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-green-500 font-bold mt-0.5 flex-shrink-0">→</span>
                        <span className="text-sm text-[#1d1d1f] leading-snug font-medium">{bullet}</span>
                      </li>
                    )) : (
                      <li className="text-sm text-gray-400">No body content available from synopsis.</li>
                    )}
                  </ul>
                </div>

                {/* OUTRO */}
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-purple-500" />
                      <span className="text-[10px] font-bold tracking-widest uppercase text-purple-700">Outro</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-gray-400">CTA + links</span>
                      <button
                        className="text-[9px] bg-gray-100 border border-gray-200 text-gray-600 px-2 py-0.5 rounded-md font-semibold hover:bg-gray-200 transition-colors"
                        onClick={() => navigator.clipboard.writeText('If this changed how you see this topic, subscribe for more research-backed breakdowns every week. Drop your biggest takeaway in the comments — I read every one.')}
                      >Copy</button>
                    </div>
                  </div>
                  <p className="text-sm text-[#1d1d1f] leading-relaxed mb-4 font-medium">
                    {csOutro}
                  </p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {['[SUBSCRIBE]', '[INSTAGRAM]', '[NEWSLETTER]'].map(link => (
                      <span key={link} className="bg-gray-100 border border-gray-200 text-xs font-bold text-[#1d1d1f] px-2.5 py-1 rounded-lg">{link}</span>
                    ))}
                  </div>
                  <p className="text-[11px] text-gray-500">
                    Sources &amp; reading: <span className="font-bold text-blue-600 cursor-pointer">[SOURCES LINK]</span>
                  </p>
                </div>
              </div>
            )}

            {/* ── Tab 5: Hashtag Strategy ── */}
            {contentTab === 5 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* ESTABLISHED */}
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-gray-500" />
                      <span className="text-[10px] font-bold tracking-widest uppercase text-gray-700">Established</span>
                    </div>
                    <span className="text-[9px] bg-gray-100 border border-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-semibold">Consistency</span>
                  </div>
                  <p className="text-[11px] text-gray-500 mb-4 leading-relaxed">Already part of your channel&apos;s vocabulary. Use these to reinforce tag authority and keep content discoverable within your existing audience base.</p>
                  <div className="flex flex-wrap gap-2">
                    {(csEstablished.length > 0 ? csEstablished : ['#content', '#education', '#learning']).map((tag, i) => (
                      <div key={i} className="flex items-center gap-1.5 bg-gray-100 border border-gray-200 rounded-full px-3 py-1.5">
                        <span className="text-[10px] text-gray-400 font-bold">↺</span>
                        <span className="text-xs font-bold text-[#1d1d1f]">{tag}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* EXPANSION */}
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-[10px] font-bold tracking-widests uppercase text-green-700">Expansion</span>
                    </div>
                    <span className="text-[9px] bg-green-100 border border-green-200 text-green-700 px-2 py-0.5 rounded-full font-semibold">New reach</span>
                  </div>
                  <p className="text-[11px] text-gray-500 mb-4 leading-relaxed">New territory for your channel. Each expansion tag surfaces this video to audiences who don&apos;t follow you yet. Minimum 2 always required for reach growth.</p>
                  <div className="flex flex-wrap gap-2">
                    {(csExpansion.length > 0 ? csExpansion : ['#newcontent', '#trending']).map((tag, i) => (
                      <div key={i} className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-full px-3 py-1.5">
                        <span className="text-[10px] text-green-500 font-bold">↗</span>
                        <span className="text-xs font-bold text-green-800">{tag}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">

          {/* Sidebar — Structure */}
          <div className="lg:col-span-1 order-1 lg:order-1 ">
            <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm h-[60vh] lg:h-[calc(100vh-10rem)] flex flex-col overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex-shrink-0">
                <h2 className="text-sm font-semibold text-[#1d1d1f]">Script Structure</h2>
                <p className="text-[11px] text-[#6e6e73] font-light mt-0.5">Flow & section breakdown</p>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-3">
                {structureSegments.length > 0 ? (
                  <div className="space-y-2">
                    {structureSegments.map((seg, index) => (
                      <div key={index} className="flex items-start gap-3">
                        <div className="flex flex-col items-center flex-shrink-0">
                          <div className="w-6 h-6 rounded-full bg-[#1d1d1f] text-white flex items-center justify-center text-[10px] font-semibold">{index + 1}</div>
                          {index < structureSegments.length - 1 && <div className="w-px bg-gray-200 flex-1 mt-1 min-h-[10px]" />}
                        </div>
                        <div className="flex-1 bg-[#f5f5f7] rounded-xl px-3 py-2 border border-gray-100 min-w-0 mb-2">
                          <p className="font-medium text-xs text-[#1d1d1f] break-words">{seg.name}</p>
                          <p className="text-[10px] text-[#6e6e73] mt-0.5 font-light">{seg.percentage}% of script</p>
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
          <div className="lg:col-span-3 order-2 lg:order-2 ">
            <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm h-[80vh] lg:h-[calc(140vh-10rem)] flex flex-col overflow-hidden">

              {/* Toolbar */}
              <div className="px-5 py-3.5 border-b border-gray-100 flex-shrink-0 flex flex-col sm:flex-row sm:items-center gap-3 ">
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-semibold text-[#1d1d1f]">Script</h2>
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
              <div className={`relative ${isUnlocked ? 'flex-1 overflow-y-auto' : 'overflow-hidden'}`}
                style={!isUnlocked ? { maxHeight: '82vh' } : {}}>

                <div
                  id="script-content"
                  className={`px-6 sm:px-8 py-6 ${!isUnlocked ? 'select-none pointer-events-none' : ''}`}
                >
                  <div
                    className="text-[#1d1d1f] leading-[1.9] text-[15px] sm:text-base max-w-3xl mx-auto text-justify"
                    style={{ fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
                  >
                    {formatScript(data.script || 'No script available.')}
                  </div>
                </div>

                {/* ── Locked overlays ── */}
                {!isUnlocked && (
                  <>
                    {/* Blur band 1: 10%–40% */}
                    <div
                      className="absolute left-0 right-0 pointer-events-none"
                      style={{
                        top: '20%', height: '20%',
                        backdropFilter: 'blur(7px)',
                        WebkitBackdropFilter: 'blur(7px)',
                        background: 'rgba(255,255,255,0.25)',
                      }}
                    />

                    {/* Clear band: 40%–50% — no overlay */}

                    {/* Blur band 2: 50%–80% */}
                    <div
                      className="absolute left-0 right-0 pointer-events-none"
                      style={{
                        top: '60%', height: '20%',
                        backdropFilter: 'blur(7px)',
                        WebkitBackdropFilter: 'blur(7px)',
                        background: 'rgba(255,255,255,0.25)',
                      }}
                    />

                    Bottom fade-to-white: 80%–100%
                    <div
                      className="absolute left-0 right-0 bottom-0 pointer-events-none"
                      style={{
                        height: '20%',
                        background: 'linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,0.97) 100%)',
                      }}
                    />

                    {/* Unlock button — centered */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <button
                        onClick={handleUnlock}
                        disabled={isUnlocking}
                        className="flex items-center gap-2.5 bg-[#1d1d1f] hover:bg-black text-white text-sm font-semibold px-7 py-3.5 rounded-2xl shadow-2xl shadow-black/20 transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] disabled:opacity-60"
                      >
                        {isUnlocking
                          ? <><Loader2 className="w-4 h-4 animate-spin" />Unlocking…</>
                          : <><Unlock className="w-4 h-4" />Unlock Script</>
                        }
                      </button>
                    </div>
                  </>
                )}


                 {/* ── Feedback Section ── */}
      {isUnlocked && (
        <section className="max-w-3xl mx-auto px-6 sm:px-8 py-10">
          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-[#1d1d1f]">How was this script?</h3>
              <p className="text-[11px] text-[#6e6e73] font-light mt-0.5">Your feedback helps us improve script quality</p>
            </div>

            {feedbackSubmitted ? (
              <div className="flex flex-col items-center gap-3 py-10">
                <div className="w-12 h-12 rounded-full bg-green-100 border border-green-200 flex items-center justify-center">
                  <span className="text-xl">🎉</span>
                </div>
                <p className="text-sm font-semibold text-[#1d1d1f]">Thanks for your feedback!</p>
                <p className="text-[11px] text-[#6e6e73] font-light">We&apos;ll use it to make scripts even better.</p>
              </div>
            ) : (
              <div className="px-6 py-6 space-y-6">
                {/* Rating row */}
                <div>
                  <p className="text-xs font-medium text-[#1d1d1f] mb-3">Rate this script</p>
                  <div className="flex flex-wrap gap-3">
                    {[
                      { label: 'Bad',       emoji: '😞' },
                      { label: 'Ok',        emoji: '😐' },
                      { label: 'Good',      emoji: '😊' },
                      { label: 'Very Good', emoji: '😄' },
                      { label: 'Excellent', emoji: '🤩' },
                    ].map(({ label, emoji }) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setFeedbackRating(label)}
                        className={`flex flex-col items-center gap-1.5 px-4 py-3 rounded-2xl border text-center transition-all duration-150 min-w-[72px] ${
                          feedbackRating === label
                            ? 'border-[#1d1d1f] bg-[#1d1d1f] text-white shadow-md scale-[1.04]'
                            : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-[#f5f5f7]'
                        }`}
                      >
                        <span className="text-2xl leading-none">{emoji}</span>
                        <span className={`text-[10px] font-medium ${feedbackRating === label ? 'text-white' : 'text-[#6e6e73]'}`}>
                          {label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Comment */}
                <div>
                  <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5">
                    Comment <span className="text-[#6e6e73] font-light">(optional)</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="What did you like or what could be improved?"
                    value={feedbackComment}
                    onChange={e => setFeedbackComment(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-[#f5f5f7] text-[#1d1d1f] text-sm placeholder-[#a1a1a6] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/20 focus:border-[#1d1d1f] transition-all resize-none"
                  />
                </div>

                {feedbackError && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
                    {feedbackError}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleFeedbackSubmit}
                  disabled={!feedbackRating || feedbackSubmitting}
                  className="w-full py-2.5 rounded-xl bg-[#1d1d1f] hover:bg-black text-white text-sm font-medium transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {feedbackSubmitting
                    ? <><Loader2 className="w-4 h-4 animate-spin" />Submitting…</>
                    : 'Submit Feedback'}
                </button>
              </div>
            )}
          </div>
        </section>
      )}
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

      {/* ── Insufficient Credits Popup ── */}
      {showInsufficientPopup && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl shadow-black/20 border border-gray-200/80 p-8 max-w-sm w-full text-center">
            <div className="w-14 h-14 rounded-full bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-7 h-7 text-red-500" />
            </div>
            <h2 className="text-lg font-semibold text-[#1d1d1f] mb-2">Not enough credits</h2>
            <p className="text-sm text-[#6e6e73] font-light leading-relaxed mb-6">
              You don&apos;t have enough credits to unlock this script. Upgrade your plan to keep generating content.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => { setShowInsufficientPopup(false); router.push('/pricing'); }}
                className="w-full py-2.5 rounded-xl bg-[#1d1d1f] hover:bg-black text-white text-sm font-medium transition-all duration-200 hover:scale-[1.01]"
              >
                View Plans
              </button>
              <button
                onClick={() => setShowInsufficientPopup(false)}
                className="w-full py-2 rounded-xl text-sm text-[#6e6e73] hover:text-[#1d1d1f] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Exit Feedback Popup ── */}
      {showExitFeedback && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl shadow-black/20 border border-gray-200/80 p-6 max-w-sm w-full">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-[#1d1d1f]">Before you go…</h2>
                <p className="text-[11px] text-[#6e6e73] font-light mt-0.5">Help us improve — why are you leaving?</p>
              </div>
              <button
                onClick={handleExitClose}
                className="w-7 h-7 rounded-full bg-[#f5f5f7] hover:bg-gray-200 flex items-center justify-center transition-colors flex-shrink-0 ml-3"
              >
                <X className="w-3.5 h-3.5 text-[#1d1d1f]" />
              </button>
            </div>

            {/* Rating */}
            <div className="mb-4">
              <p className="text-xs font-medium text-[#1d1d1f] mb-2.5">Rate your experience</p>
              <div className="flex gap-2 flex-wrap">
                {[
                  { label: 'Bad',       emoji: '😞' },
                  { label: 'Ok',        emoji: '😐' },
                  { label: 'Good',      emoji: '😊' },
                  { label: 'Very Good', emoji: '😄' },
                  { label: 'Excellent', emoji: '🤩' },
                ].map(({ label, emoji }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setExitRating(label)}
                    className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl border text-center transition-all duration-150 flex-1 min-w-[52px] ${
                      exitRating === label
                        ? 'border-[#1d1d1f] bg-[#1d1d1f] text-white shadow-md scale-[1.04]'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-[#f5f5f7]'
                    }`}
                  >
                    <span className="text-xl leading-none">{emoji}</span>
                    <span className={`text-[9px] font-medium leading-tight ${exitRating === label ? 'text-white' : 'text-[#6e6e73]'}`}>
                      {label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Comment */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5">
                Comment <span className="text-[#6e6e73] font-light">(optional)</span>
              </label>
              <textarea
                rows={3}
                placeholder="Tell us what could be better…"
                value={exitComment}
                onChange={e => setExitComment(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-[#f5f5f7] text-[#1d1d1f] text-sm placeholder-[#a1a1a6] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/20 focus:border-[#1d1d1f] transition-all resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleExitSubmit}
                disabled={!exitRating || exitSubmitting}
                className="w-full py-2.5 rounded-xl bg-[#1d1d1f] hover:bg-black text-white text-sm font-medium transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {exitSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" />Submitting…</> : 'Submit & Leave'}
              </button>
              <button
                type="button"
                onClick={handleExitClose}
                className="w-full py-2 rounded-xl text-sm text-[#6e6e73] hover:text-[#1d1d1f] transition-colors"
              >
                Skip & Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
