"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2, FileText, Lightbulb, BookOpen, History,
  Search, Link as LinkIcon, ExternalLink, Clock, Copy, Check, ImageIcon, Hash,
  Eye, Monitor, Download, X, Lock, Unlock, AlertCircle, Rocket, Target
} from 'lucide-react';
// Note: GeneratedScript component exists in the project but is not used in this detailed view
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import GenerationProgressOverlay from '@/components/GenerationProgressOverlay';
import { ApiFailCard } from '@/components/ApiFailCard';
import { ApiService, GenerationParams, GeneratedScriptData } from '@/services/api';
import { supabase } from '@/lib/supabaseClient';
import { unwrapScriptJson, normalizeScriptData } from '@/lib/script-data';
import { STORYBIT_PRODUCTION_GUIDE } from '@/lib/production-guide';
import {
  buildScriptTableRow,
  normalizeGeneratedThumbnailList,
  SCRIPT_ROW_SELECT,
} from '@/lib/script-persistence';
import {
  lockedScriptPlaceholder,
  SCRIPT_ROW_SELECT_LOCKED,
} from '@/lib/script-security';
import { withBlurredPatches } from '@/components/studio/renderRedactedScript';
import nlp from 'compromise';

// Accent colors cycled across the SEO option cards (option 1 / 2 / 3)
const OPTION_META = [
  { dot: 'bg-purple-500', label: 'text-purple-700', border: 'border-purple-200', bg: 'bg-purple-50' },
  { dot: 'bg-blue-500',   label: 'text-blue-700',   border: 'border-blue-200',   bg: 'bg-blue-50'   },
  { dot: 'bg-green-500',  label: 'text-green-700',  border: 'border-green-200',  bg: 'bg-green-50'  },
] as const;

const SCRIPT_GENERATION_STEPS = [
  'Understanding your topic',
  'Web searching for factual information',
  'Analysing the data',
  'Generating your script for YouTube',
  'Finishing',
];

/**
 * Normalizes a /generate-script response (or a Supabase row) into
 * GeneratedScriptData, bridging the new structure
 * (youtube_metadata / metrics / sources / books) with legacy fields
 * (seo / analysis / source_urls) so both old and new payloads render.
 */
// normalizeScriptData / extractScriptText / unwrapScriptJson live in @/lib/script-data

function cleanScriptText(text: string): string {
  if (!text) return '';

  // unwrap weird spacing/newlines
  let cleaned = text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // fix wrapped lines
  cleaned = cleaned
    .split('\n')
    .map(line => line.trim())
    .join(' ');

  // NLP sentence detection
  const doc = nlp(cleaned);
  const sentences = doc.sentences().out('array');

  // rebuild readable paragraphs
  const paragraphs: string[] = [];
  let current: string[] = [];

  sentences.forEach((sentence: string, index: number) => {
    current.push(sentence);

    // create paragraph every 3-5 sentences
    const shouldBreak =
      current.length >= 4 ||
      sentence.includes(':') ||
      sentence.length > 180;

    if (shouldBreak) {
      paragraphs.push(current.join(' '));
      current = [];
    }
  });

  if (current.length > 0) {
    paragraphs.push(current.join(' '));
  }

  return paragraphs.join('\n\n');
}

// Format script text: *** becomes <hr/>, *word* becomes <strong>word</strong>, \n\n becomes paragraphs
function formatScript(text: string): React.ReactNode[] {
  if (!text) return [];

  const scriptText = cleanScriptText(
    unwrapScriptJson(text)
  );
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
        if (match.index > lastIndex) {
          parts.push(
            ...withBlurredPatches(
              para.slice(lastIndex, match.index),
              `t-${sectionIndex}-${paraIndex}-${keyCounter}`,
            ),
          );
        }
        parts.push(
          <strong key={`b-${sectionIndex}-${paraIndex}-${keyCounter++}`}>
            {withBlurredPatches(match[1], `bs-${sectionIndex}-${paraIndex}-${keyCounter}`)}
          </strong>,
        );
        lastIndex = match.index + match[0].length;
      }
      if (lastIndex < para.length) {
        parts.push(
          ...withBlurredPatches(para.slice(lastIndex), `e-${sectionIndex}-${paraIndex}`),
        );
      }

      nodes.push(
        <p key={`p-${sectionIndex}-${paraIndex}`} className="mb-5">
          {parts.length > 0 ? parts : withBlurredPatches(para, `p-${sectionIndex}-${paraIndex}`)}
        </p>
      );
    });

    if (sectionIndex < sections.length - 1) {
      nodes.push(<hr key={`hr-${sectionIndex}`} className="my-6 border-gray-200" />);
    }
  });

  return nodes;
}

/** Notify studio sidebar after a script is generated (scripts live in Supabase). */
function syncScriptToStudioStorage(
  _normalizedScriptData: GeneratedScriptData,
  _universalScriptId?: string | null,
): void {
  try {
    window.dispatchEvent(new Event('studio-storage-updated'));
  } catch {
    // Never break the script page if studio sync fails
  }
}

export default function ScriptPage() {
  const router = useRouter();
  const [data, setData] = useState<GeneratedScriptData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [progressReady, setProgressReady] = useState(false);
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
  const scriptDescriptionRef = React.useRef<string | undefined>(undefined);
  const pageTitleRef         = React.useRef('Generated Script');
  // ID of the scripts_universal row (set when loaded via ?scriptId= from that table)
  const universalScriptIdRef = React.useRef<string | null>(null);

  const userIdRef            = React.useRef<string | null>(null);

  const handleProgressFinished = useCallback(() => {
    setIsLoading(false);
    setProgressReady(false);
  }, []);

  const finishLoading = useCallback(() => {
    setProgressReady(true);
  }, []);

 

  
  useEffect(() => {
    if (hasCalledRef.current) return; // ✅ prevents double call
    hasCalledRef.current = true;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // Save destination so sign-in can resume the generation flow
        try { localStorage.setItem('post_auth_redirect', window.location.href); } catch {}
        setIsRedirecting(true);
        router.push('/auth');
        return;
      }

      setShouldRender(true);
      userIdRef.current = session.user.id;

    const run = async () => {
      const userId = session.user.id;
      setIsLoading(true);
      setProgressReady(false);
      setError(null);

      // ── Load by scriptId ────────────────────────────────────────────────────
      const urlSearchParams = new URLSearchParams(window.location.search);
      const scriptId = urlSearchParams.get('scriptId');
      if (scriptId) {
        // 1. Try user's unlocked scripts table (show fully unlocked)
        const { data: row } = await supabase
          .from('scripts_assigned')
          .select(SCRIPT_ROW_SELECT)
          .eq('id', scriptId)
          .maybeSingle();

        if (row) {
          const normalized: GeneratedScriptData = {
            ...normalizeScriptData(row),
            title: row.title ?? row.topic ?? 'Script',
            locked: false,
          };
          setData(normalized);
          setPageTitle(row.title || row.topic || 'Script');
          setScriptTopic(row.topic ?? undefined);
          setScriptDescription((row as { description?: string }).description ?? undefined);
          setScriptDuration(row.metrics?.videoLength ?? undefined);
          setIsUnlocked(true);
          setScriptSaved(true);
          finishLoading();
          return;
        }

        // 2. Try scripts_universal (locked — omit script column; unlock to reveal)
        const { data: uRow, error: uErr } = await supabase
          .from('scripts_universal')
          .select(SCRIPT_ROW_SELECT_LOCKED)
          .eq('id', scriptId)
          .maybeSingle();

        if (uErr || !uRow) {
          setError('Script not found.');
          setIsLoading(false);
          return;
        }

        const uBase = normalizeScriptData(uRow);
        let preview = '';
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user?.id && uRow.id) {
            preview = await ApiService.fetchScriptPreview({
              id: String(uRow.id),
              userId: session.user.id,
            });
          }
        } catch { /* ignore */ }
        const uNormalized: GeneratedScriptData = {
          ...uBase,
          title: uRow.title ?? uRow.topic ?? 'Script',
          script: preview.trim() || lockedScriptPlaceholder(uBase.structure),
          locked: true,
          scriptsByLanguage: undefined,
          scriptRowId: uRow.id != null ? String(uRow.id) : null,
        };
        setData(uNormalized);
        setPageTitle(uRow.title || uRow.topic || 'Script');
        setScriptTopic(uRow.topic ?? undefined);
        setScriptDescription((uRow as { description?: string }).description ?? undefined);
        setScriptDuration(uRow.metrics?.videoLength ?? undefined);
        universalScriptIdRef.current = uRow.id; // remember for unlock
        finishLoading();
        return;
      }
      // ────────────────────────────────────────────────────────────────────────

      // Generation params from URL query (older flows like /script?topic=...&time=...)
      // Do not restore scripts from localStorage / sessionStorage — only Supabase or generate API.
      const search = window.location.search;
      const urlParams = new URLSearchParams(search);
      if (urlParams.has('topic') || urlParams.has('duration') || urlParams.has('time')) {
        const topic = urlParams.get('topic') || undefined;
        const duration = urlParams.get('time') || urlParams.get('duration') || undefined;
        const payload: GenerationParams = {
          userId: session.user.id,
          title: topic || 'Untitled',
          description: topic || '',
          topic: topic || '',
          time: duration ? parseInt(duration, 10) : 10,
        };
        try {
          let raw: GeneratedScriptData;
          try {
            raw = await ApiService.generateScript(payload);
          } catch (error: any) {
            if (error.message?.includes('timeout')) {
              console.warn('Timeout ignored (URL params)');
              return;
            }
            throw error;
          }

          const normalized = normalizeScriptData(raw);
          const universalId =
            raw.scriptRowId != null && String(raw.scriptRowId).trim()
              ? String(raw.scriptRowId)
              : null;
          const lockedData: GeneratedScriptData = {
            ...normalized,
            locked: true,
            scriptRowId: universalId,
          };
          const scriptTitle = lockedData.title || topic || 'Generated Script';

          if (universalId) universalScriptIdRef.current = universalId;
          syncScriptToStudioStorage(lockedData, universalId);

          setData(lockedData);
          setScriptDuration(
            lockedData.metrics?.videoLength ?? payload.time ?? undefined,
          );
          if (payload.title) setScriptTopic(payload.title);
          if (payload.description) setScriptDescription(payload.description);
          setPageTitle(scriptTitle);
          finishLoading();
          return;
        } catch (err) {
          const error = err as Error;
          if (error.message.includes('Unauthorized') || error.message.includes('Not authenticated')) {
            setIsRedirecting(true);
            supabase.auth.signOut();
            router.push('/auth');
            return;
          }
          console.error('Failed to Generate Content from URL params:', error);
          setError(error.message || 'Failed to Generate Content from URL params');
          setIsLoading(false);
          return;
        }
      }

      setError('No generation parameters found. Please go back and create a script from a topic.');
      setIsLoading(false);
    };
    run();
  })();
  }, [router, finishLoading]);

  const [showSourcesDialog, setShowSourcesDialog] = useState(false);
  const [sidePanelMode, setSidePanelMode] = useState<'sources' | 'books'>('sources');
  const [contentTab, setContentTab] = useState<1|2|3|4>(1);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // ── Structure highlight / scroll ─────────────────────────────────────────
  const [activeSegment, setActiveSegment] = useState<number | null>(null);
  const segmentRefs    = React.useRef<(HTMLDivElement | null)[]>([]);
  const scriptScrollRef = React.useRef<HTMLDivElement | null>(null);

  const scrollToSegment = (index: number) => {
    if (!isUnlocked) return;
  
    setActiveSegment(index);
  
    const el = segmentRefs.current[index];
    const container = scriptScrollRef.current;
  
    if (!el || !container) return;
  
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
  
    const target =
      container.scrollTop +
      elRect.top -
      containerRect.top -
      containerRect.height / 2 +
      elRect.height / 2;
  
    container.scrollTo({
      top: target,
      behavior: 'smooth',
    });
  };

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
  const [showProductionGuidePopup, setShowProductionGuidePopup] = useState(false);
  const [scriptDuration, setScriptDuration] = useState<number | undefined>();
  const [scriptTopic, setScriptTopic] = useState<string | undefined>();
  const [scriptDescription, setScriptDescription] = useState<string | undefined>();
  const [scriptSaved, setScriptSaved] = useState(false); // prevent duplicate saves

  // ── Exit feedback (shown when user tries to leave without unlocking) ────────
  const [showExitFeedback, setShowExitFeedback]   = useState(false);
  const [exitRating, setExitRating]               = useState('');
  const [exitComment, setExitComment]             = useState('');
  const [exitSubmitting, setExitSubmitting]       = useState(false);
  const allowExitRef = React.useRef(false);
  const [credits, setCredits] = useState<number>(0)

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
  useEffect(() => { scriptDescriptionRef.current = scriptDescription; }, [scriptDescription]);
  useEffect(() => { pageTitleRef.current      = pageTitle;      }, [pageTitle]);

  // Helper: POST to scripts_universal using fetch keepalive (safe during page unload)
  const saveToUniversalScripts = React.useCallback(async () => {
    const d = dataRef.current;
    const params = new URLSearchParams(window.location.search);

if (params.get('from') === 'suggested') {
  return;
}
    // Already saved on generate, or unlocked / assigned — skip unload duplicate
    if (!d || isUnlockedRef.current || scriptSavedRef.current || universalScriptIdRef.current) return;
    const userId = userIdRef.current;
    if (!userId) return;
    const topic = scriptTopicRef.current
      ?? new URLSearchParams(window.location.search).get('topic')
      ?? pageTitleRef.current;
    const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    const supabaseKey  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
    const row = buildScriptTableRow(d, {
      title: d.title || pageTitleRef.current || topic || undefined,
      topic: topic || undefined,
      description: scriptDescriptionRef.current || undefined,
      userId,
    });
    fetch(
      `${supabaseUrl}/rest/v1/scripts_universal`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify(row),
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

  // ── Selected-idea session (for studio continuity) ──────────────────────────
  // Clear any legacy pending_unused_idea — writing a single idea to /save-ideas
  // was overwriting the full topic idea list in saved_ideas.
  useEffect(() => {
    try { sessionStorage.removeItem('pending_unused_idea'); } catch {}
  }, []);

  const handleUnlock = async () => {
    setIsUnlocking(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/auth'); return; }

      const uniId = universalScriptIdRef.current || data?.scriptRowId;
      if (!uniId) {
        setShowInsufficientPopup(true);
        return;
      }

      // Charge unlock against actual Video Length (metrics), not the requested generate time
      const fromMetrics = Number(data?.metrics?.videoLength);
      const fromState = Number(scriptDuration);
      const duration =
        Number.isFinite(fromMetrics) && fromMetrics > 0
          ? fromMetrics
          : Number.isFinite(fromState) && fromState > 0
            ? fromState
            : 10;

      const topic =
        scriptTopic ??
        new URLSearchParams(window.location.search).get('topic') ??
        pageTitle;

      let json;
      try {
        json = await ApiService.unlockScript({
          userId: session.user.id,
          duration,
          universalScriptId: String(uniId),
          title: data?.title || pageTitle || topic || undefined,
          topic: topic || undefined,
          description: scriptDescription || undefined,
        });
      } catch {
        setShowInsufficientPopup(true);
        return;
      }

      const full = normalizeScriptData(json.script);
      setData({ ...full, locked: false, scriptRowId: null });
      setIsUnlocked(true);
      isUnlockedRef.current = true;
      setScriptSaved(true);
      setShowProductionGuidePopup(true);
      universalScriptIdRef.current = null;

      // Script was unlocked → clear any legacy unused-idea markers / unlock flags
      try {
        sessionStorage.removeItem('pending_unused_idea');
        const keys = Object.keys(localStorage);
        for (const k of keys) {
          if (k.endsWith('_unlocked') || k.startsWith('script_') || k === 'script_latest_key') {
            localStorage.removeItem(k);
          }
        }
      } catch {}

      if (json.remaining_credits !== undefined) {
        setCredits(json.remaining_credits);
      }
      window.dispatchEvent(new Event('creditsUpdated'));
    } catch (err) {
      console.error('Unlock error:', err);
      setShowInsufficientPopup(true);
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

  useEffect(() => {
    if (!showProductionGuidePopup) return;

    const scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      window.scrollTo(0, scrollY);
    };
  }, [showProductionGuidePopup]);


  /* ---------------- DOWNLOAD PDF ---------------- */

  const handleDownload = async () => {
    if (!isUnlocked) return;
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
    if (!isUnlocked || !data) return;
    sessionStorage.setItem("teleprompter_script", data.script || "");
    router.push("/teleprompter");
  };

  // ── Must be above all early returns to satisfy Rules of Hooks ──────────────
  const structureSegments = (data?.structure ?? []);

  const scriptSegmentTexts = React.useMemo(() => {
    const script = cleanScriptText(
      unwrapScriptJson(data?.script || '')
    );
  
    if (structureSegments.length === 0) return [script];
  
    const words = script.split(/\s+/);
    const totalWords = words.length;
  
    const chunks: string[] = [];
    let wordPos = 0;
    let cumulative = 0;
  
    structureSegments.forEach((s, i) => {
      cumulative += s.percentage;
  
      const isLast = i === structureSegments.length - 1;
  
      const endWord = isLast
        ? totalWords
        : Math.min(
            Math.round((cumulative / 100) * totalWords),
            totalWords
          );
  
      chunks.push(words.slice(wordPos, endWord).join(' '));
  
      wordPos = endWord;
    });
  
    return chunks;
  }, [data?.script, structureSegments]);
  // ─────────────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f5f5f7]">
        <Header />
        <GenerationProgressOverlay
          isOpen
          ready={progressReady}
          onFinished={handleProgressFinished}
          steps={SCRIPT_GENERATION_STEPS}
          subtext="Usually under 5 minutes. We'll keep working in the background."
        />
        <Footer />
      </div>
    );
  }

  if (error) return (
    <div className="min-h-screen bg-[#f5f5f7] flex flex-col">
      <Header />
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full">
          <ApiFailCard onRetry={() => window.location.reload()} variant="full" />
          <p className="text-center mt-4">
            <button onClick={() => window.history.back()} className="text-sm text-[#6e6e73] underline hover:text-[#1d1d1f] transition-colors">
              or go back
            </button>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
  if (!data) return null;

  // Don't render anything if redirecting or not yet validated
  if (!shouldRender || isRedirecting) {
    return null;
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

  const m = data.metrics;
  const metrics = [
    { icon: FileText,  label: 'Total Words',     value: m?.totalWords ?? data.estimated_word_count ?? 0 },
    { icon: Clock,     label: 'Video Length',    value: m?.videoLength != null ? `${Math.round(m.videoLength * 10) / 10} min` : '—' },
    { icon: Search,    label: 'Research Facts',  value: m?.researchFacts ?? data.analysis?.research_facts_count ?? 0 },
    { icon: History,   label: 'Hist. Facts',     value: m?.historical_facts ?? data.analysis?.history ?? 0 },
    { icon: BookOpen,  label: 'Proverbs',        value: m?.proverbs_count ?? data.analysis?.proverbs_count ?? 0 },
    { icon: Lightbulb, label: 'Examples',        value: m?.generalExamples ?? data.analysis?.examples_count ?? 0 },
  ];

  // ── SEO Panel — driven by youtube_metadata from /generate-script ─────────
  // Legacy scripts persisted the old seo shape (sometimes double-nested as seo.seo)
  const legacySeo: any = data.seo?.seo ?? data.seo ?? {};
  const ytMeta = data.youtube_metadata;

  const seoTitles: string[] =
    (ytMeta?.titles?.length ? ytMeta.titles : null)
    ?? (legacySeo?.recommended_titles ?? []).map((t: any) => t?.title).filter(Boolean);

  const seoDescriptions: string[] = ytMeta?.descriptions ?? [];

  const legacyHashtags: string[] = (legacySeo?.hashtags ?? [])
    .map((h: any) => (typeof h === 'string' ? h : h?.hashtag))
    .filter(Boolean);
  const seoHashtagSets: string[][] =
    (ytMeta?.hashtags?.length ? ytMeta.hashtags : null)
    ?? (legacyHashtags.length > 0 ? [legacyHashtags] : []);

  const seoThumbnailTexts: string[] =
    (ytMeta?.thumbnail_text?.length ? ytMeta.thumbnail_text : null)
    ?? (legacySeo?.thumbnail_brief ?? []).map((t: any) => t?.text_overlay).filter(Boolean);

  const generatedThumbnails = normalizeGeneratedThumbnailList(data.thumbnail_generated);

  const books = data.books ?? [];

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(k => (k === key ? null : k)), 1500);
  };

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
        <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
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
              [1, 'Titles'],
              [2, 'Descriptions'],
              [3, 'Hashtags'],
              [4, 'Thumbnails'],
            ] as [number, string][]).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setContentTab(id as 1|2|3|4)}
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

            {/* ── Tab 1: Titles ── */}
            {contentTab === 1 && (
              seoTitles.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {seoTitles.map((title, i) => {
                    const meta = OPTION_META[i % OPTION_META.length];
                    const chars = title.length;
                    const verdict = chars <= 60 ? 'within limit' : chars <= 79 ? 'optimal' : 'trim needed';
                    const verdictColor = chars <= 60 ? 'text-green-600' : chars <= 79 ? 'text-green-500' : 'text-amber-500';
                    const copyKey = `title-${i}`;
                    return (
                      <div key={i} className="rounded-xl border border-gray-200 bg-white p-4 transition-all hover:border-gray-300 hover:bg-gray-50/60">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${meta.dot}`} />
                            <span className={`text-[10px] font-bold tracking-widest uppercase ${meta.label}`}>Title {i + 1}</span>
                          </div>
                          <button
                            className="flex items-center gap-1 text-[9px] bg-gray-100 border border-gray-200 text-gray-600 px-2 py-0.5 rounded-md font-semibold hover:bg-gray-200 transition-colors"
                            onClick={() => handleCopy(copyKey, title)}
                          >
                            {copiedKey === copyKey ? <><Check className="w-3 h-3 text-green-600" />Copied</> : <><Copy className="w-3 h-3" />Copy</>}
                          </button>
                        </div>
                        <p className="text-[#1d1d1f] font-bold text-sm leading-snug mb-2">{title}</p>
                        <p className={`text-[11px] font-semibold ${verdictColor}`}>{chars} chars · {verdict}</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <FileText className="w-8 h-8 text-gray-300 mb-2" />
                  <p className="text-xs text-[#6e6e73]">No title suggestions available</p>
                </div>
              )
            )}

            {/* ── Tab 2: Descriptions ── */}
            {contentTab === 2 && (
              seoDescriptions.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {seoDescriptions.map((desc, i) => {
                    const meta = OPTION_META[i % OPTION_META.length];
                    const copyKey = `desc-${i}`;
                    return (
                      <div key={i} className="rounded-xl border border-gray-200 bg-white p-4 transition-all hover:border-gray-300 hover:bg-gray-50/60">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${meta.dot}`} />
                            <span className={`text-[10px] font-bold tracking-widest uppercase ${meta.label}`}>Description {i + 1}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-gray-400">{desc.length} chars</span>
                            <button
                              className="flex items-center gap-1 text-[9px] bg-gray-100 border border-gray-200 text-gray-600 px-2 py-0.5 rounded-md font-semibold hover:bg-gray-200 transition-colors"
                              onClick={() => handleCopy(copyKey, desc)}
                            >
                              {copiedKey === copyKey ? <><Check className="w-3 h-3 text-green-600" />Copied</> : <><Copy className="w-3 h-3" />Copy</>}
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-[#1d1d1f] leading-relaxed">{desc}</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <FileText className="w-8 h-8 text-gray-300 mb-2" />
                  <p className="text-xs text-[#6e6e73]">No descriptions available</p>
                </div>
              )
            )}

            {/* ── Tab 3: Hashtags ── */}
            {contentTab === 3 && (
              seoHashtagSets.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {seoHashtagSets.map((set, i) => {
                    const meta = OPTION_META[i % OPTION_META.length];
                    const copyKey = `tags-${i}`;
                    return (
                      <div key={i} className="rounded-xl border border-gray-200 bg-white p-4 transition-all hover:border-gray-300 hover:bg-gray-50/60">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${meta.dot}`} />
                            <span className={`text-[10px] font-bold tracking-widest uppercase ${meta.label}`}>Set {i + 1}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-gray-400">{set.length} tags</span>
                            <button
                              className="flex items-center gap-1 text-[9px] bg-gray-100 border border-gray-200 text-gray-600 px-2 py-0.5 rounded-md font-semibold hover:bg-gray-200 transition-colors"
                              onClick={() => handleCopy(copyKey, set.join(' '))}
                            >
                              {copiedKey === copyKey ? <><Check className="w-3 h-3 text-green-600" />Copied</> : <><Copy className="w-3 h-3" />Copy all</>}
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {set.map((tag, j) => (
                            <div key={j} className="flex items-center gap-1 bg-gray-100 border border-gray-200 rounded-full px-2.5 py-1">
                              <Hash className="w-3 h-3 text-gray-400" />
                              <span className="text-[11px] font-bold text-[#1d1d1f]">{tag.replace(/^#/, '')}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <Hash className="w-8 h-8 text-gray-300 mb-2" />
                  <p className="text-xs text-[#6e6e73]">No hashtags available</p>
                </div>
              )
            )}

            {/* ── Tab 4: Thumbnails ── */}
            {contentTab === 4 && (
              (generatedThumbnails.length > 0 || seoThumbnailTexts.length > 0) ? (
                <div className="space-y-4">
                  {generatedThumbnails.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {generatedThumbnails.map((thumb, ti) => (
                        <div
                          key={`${thumb.public_url}-${ti}`}
                          className="rounded-xl border border-gray-200 bg-white overflow-hidden"
                        >
                          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
                            <div>
                              <h3 className="text-sm font-semibold text-[#1d1d1f]">
                                Generated thumbnail {ti + 1}
                              </h3>
                              <p className="text-[11px] text-[#6e6e73] font-light mt-0.5">
                                Saved on your unlocked script
                              </p>
                            </div>
                            {thumb.public_url && (
                              <a
                                href={thumb.public_url}
                                download
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1d1d1f] bg-[#f5f5f7] border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-200"
                              >
                                <Download className="w-3.5 h-3.5" />
                                Download
                              </a>
                            )}
                          </div>
                          <div className="p-4">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={thumb.public_url || ''}
                              alt={`Generated thumbnail ${ti + 1}`}
                              className="w-full rounded-xl border border-gray-100 aspect-video object-cover"
                            />
                            {thumb.prompt && (
                              <p className="mt-3 text-xs text-[#6e6e73] leading-relaxed">
                                {thumb.prompt}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {seoThumbnailTexts.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {seoThumbnailTexts.map((text, i) => {
                        const meta = OPTION_META[i % OPTION_META.length];
                        const copyKey = `thumb-${i}`;
                        return (
                          <div key={i} className="rounded-xl border border-gray-200 bg-white p-4 transition-all hover:border-gray-300 hover:bg-gray-50/60">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${meta.dot}`} />
                                <span className={`text-[10px] font-bold tracking-widest uppercase ${meta.label}`}>Concept {i + 1}</span>
                              </div>
                              <button
                                className="flex items-center gap-1 text-[9px] bg-gray-100 border border-gray-200 text-gray-600 px-2 py-0.5 rounded-md font-semibold hover:bg-gray-200 transition-colors"
                                onClick={() => handleCopy(copyKey, text)}
                              >
                                {copiedKey === copyKey ? <><Check className="w-3 h-3 text-green-600" />Copied</> : <><Copy className="w-3 h-3" />Copy</>}
                              </button>
                            </div>
                            {/* 16:9 thumbnail text preview */}
                            <div className="aspect-video rounded-lg bg-gradient-to-br from-[#1d1d1f] to-[#3a3a3d] flex items-center justify-center px-4 mb-2.5">
                              <p className="text-white font-extrabold text-base sm:text-lg text-center uppercase leading-tight tracking-wide drop-shadow-md">
                                {text}
                              </p>
                            </div>
                            <p className="text-[10px] text-gray-500 leading-relaxed">Suggested text overlay for your thumbnail design.</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <ImageIcon className="w-8 h-8 text-gray-300 mb-2" />
                  <p className="text-xs text-[#6e6e73]">No thumbnail available</p>
                </div>
              )
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
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold bg-[#1d1d1f] text-white">
                            {index + 1}
                          </div>
                          {index < structureSegments.length - 1 && <div className="w-px bg-gray-200 flex-1 mt-1 min-h-[10px]" />}
                        </div>
                        <button
                          type="button"
                          onClick={() => scrollToSegment(index)}
                          className="flex-1 text-left rounded-xl px-3 py-2 border min-w-0 mb-2 bg-[#f5f5f7] border-gray-100 hover:border-gray-300 hover:bg-white transition-all duration-200"
                        >
                          <p className="font-medium text-xs break-words text-[#1d1d1f]">{seg.name}</p>
                          <p className="text-[10px] text-[#6e6e73] mt-0.5 font-light">{seg.percentage}% of script</p>
                        </button>
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
                    onClick={() => { setSidePanelMode('sources'); setShowSourcesDialog(true); }}
                    disabled={!isUnlocked}
                    className="flex items-center gap-1.5 text-[11px] font-medium text-[#1d1d1f] bg-[#f5f5f7] hover:bg-gray-200 border border-gray-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#f5f5f7]"
                  >
                    <LinkIcon className="w-3.5 h-3.5" />
                    Sources
                  </button>
                  <button
                    onClick={() => { setSidePanelMode('books'); setShowSourcesDialog(true); }}
                    disabled={!isUnlocked}
                    className="flex items-center gap-1.5 text-[11px] font-medium text-[#1d1d1f] bg-[#f5f5f7] hover:bg-gray-200 border border-gray-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#f5f5f7]"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    Books
                  </button>
                  <button
                    onClick={handleTranslate}
                    disabled={isTranslating || !isUnlocked}
                    className="flex items-center gap-1.5 text-[11px] font-medium text-[#1d1d1f] bg-[#f5f5f7] hover:bg-gray-200 border border-gray-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isTranslating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    Translate
                  </button>
                  <button
                    onClick={handleTeleprompter}
                    disabled={!isUnlocked}
                    className="flex items-center gap-1.5 text-[11px] font-medium text-[#1d1d1f] bg-[#f5f5f7] hover:bg-gray-200 border border-gray-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#f5f5f7]"
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    Teleprompter
                  </button>
                  <button
                    onClick={handleDownload}
                    disabled={!isUnlocked}
                    className="flex items-center gap-1.5 text-[11px] font-medium text-white bg-[#1d1d1f] hover:bg-black px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#1d1d1f]"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </button>
                </div>
              </div>

              {/* Script content */}
              <div
                ref={scriptScrollRef}
                className={`relative ${isUnlocked ? 'flex-1 overflow-y-auto' : 'overflow-hidden'}`}
                style={!isUnlocked ? { maxHeight: '82vh' } : {}}>

                <div
                  id="script-content"
                  className={`px-6 sm:px-8 py-6 ${!isUnlocked ? 'select-none pointer-events-none' : ''}`}
                >
                  <div
                    className="text-[#1d1d1f] leading-[1.9] text-[15px] sm:text-base max-w-3xl mx-auto text-justify"
                    style={{ fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
                  >
                    {scriptSegmentTexts.map((chunk, i) => (
                      <div
                        key={i}
                        ref={el => { segmentRefs.current[i] = el; }}
                        className="px-3 -mx-3"
                      >
                        {formatScript(chunk || '')}
                      </div>
                    ))}
                  </div>
                </div>

                {!isUnlocked && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <button
                      onClick={handleUnlock}
                      disabled={isUnlocking}
                      className="pointer-events-auto flex items-center gap-2.5 bg-[#1d1d1f] hover:bg-black text-white text-sm font-semibold px-7 py-3.5 rounded-2xl shadow-2xl shadow-black/20 transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] disabled:opacity-60"
                    >
                      {isUnlocking
                        ? <><Loader2 className="w-4 h-4 animate-spin" />Unlocking…</>
                        : <><Unlock className="w-4 h-4" />Unlock Script</>
                      }
                    </button>
                  </div>
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

      {/* Sources / Books Side Panel */}
      <div className={`fixed top-0 right-0 h-full w-full sm:w-[400px] bg-white border-l border-gray-200 shadow-2xl z-50 transition-transform duration-300 ease-in-out ${showSourcesDialog ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#1d1d1f]">
              {sidePanelMode === 'books'
                ? `${books.length} Book${books.length === 1 ? '' : 's'}`
                : `${(data?.sources ?? data?.source_urls)?.length || 0} Source${((data?.sources ?? data?.source_urls)?.length || 0) === 1 ? '' : 's'}`}
            </h2>
            <p className="text-[11px] text-[#6e6e73] font-light">
              {sidePanelMode === 'books'
                ? 'Books referenced during research'
                : 'Research sources used in this script'}
            </p>
          </div>
          <button onClick={() => setShowSourcesDialog(false)} className="w-8 h-8 rounded-full bg-[#f5f5f7] hover:bg-gray-200 flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-[#1d1d1f]" />
          </button>
        </div>
        <ScrollArea className="h-[calc(100vh-73px)]">
          <div className="px-4 py-4 space-y-3">
            {sidePanelMode === 'sources' && (
              <>
                {(data?.sources ?? data?.source_urls)?.length ? (
                  (data?.sources ?? data?.source_urls ?? []).map((url, index) => {
                    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
                    let domain = '';
                    let domainInitial = '?';
                    try {
                      if (url) {
                        domain = new URL(href).hostname.replace('www.', '');
                        domainInitial = domain.charAt(0).toUpperCase();
                      }
                    } catch {
                      domain = url || 'Unknown source';
                      domainInitial = domain.charAt(0).toUpperCase();
                    }
                    return (
                      <a key={index} href={href} target="_blank" rel="noopener noreferrer"
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
              </>
            )}

            {sidePanelMode === 'books' && (
              <>
                {books.length > 0 ? (
                  books.map((book, index) => (
                    <div key={index} className="flex items-start gap-3 bg-[#f5f5f7] rounded-2xl p-4 border border-gray-100">
                      <div className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center flex-shrink-0 shadow-sm">
                        <BookOpen className="w-4 h-4 text-[#1d1d1f]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[#1d1d1f] leading-snug">{book.title}</p>
                        <p className="text-[11px] text-[#6e6e73] mt-0.5 font-light">{book.author}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <BookOpen className="w-10 h-10 text-gray-200 mb-3" />
                    <p className="text-sm text-[#6e6e73]">No books referenced</p>
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* ── Production Guide Popup (on unlock) ── */}
      {showProductionGuidePopup && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl shadow-black/20 border border-gray-200/80 w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-orange-50/80 via-white to-indigo-50/80 flex-shrink-0">
              <div className="min-w-0 pr-2">
                <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase mb-1">Script unlocked</p>
                <h2 className="text-base font-semibold text-[#1d1d1f] leading-snug">Your Storybit Production Playbook</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowProductionGuidePopup(false)}
                aria-label="Close"
                className="w-8 h-8 rounded-full bg-[#f5f5f7] hover:bg-gray-200 flex items-center justify-center transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4 text-[#1d1d1f]" />
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-4 space-y-5 flex-1">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Rocket className="w-4 h-4 text-orange-500 flex-shrink-0" />
                  <h3 className="text-sm font-semibold text-[#1d1d1f] leading-snug">
                    {STORYBIT_PRODUCTION_GUIDE.optimized.title}
                  </h3>
                </div>
                <div className="space-y-3">
                  {STORYBIT_PRODUCTION_GUIDE.optimized.items.map((item, index) => (
                    <div key={item.title} className="flex gap-2.5">
                      <span className="w-5 h-5 rounded-md bg-orange-50 border border-orange-100 text-orange-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#1d1d1f] leading-snug mb-0.5">{item.title}</p>
                        <p className="text-[11px] text-[#6e6e73] leading-relaxed">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Target className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                  <h3 className="text-sm font-semibold text-[#1d1d1f] leading-snug">
                    {STORYBIT_PRODUCTION_GUIDE.nextSteps.title}
                  </h3>
                </div>
                <div className="space-y-3">
                  {STORYBIT_PRODUCTION_GUIDE.nextSteps.items.map((item, index) => (
                    <div key={item.title} className="flex gap-2.5">
                      <span className="w-5 h-5 rounded-md bg-indigo-50 border border-indigo-100 text-indigo-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#1d1d1f] leading-snug mb-0.5">{item.title}</p>
                        <p className="text-[11px] text-[#6e6e73] leading-relaxed">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-gray-100 bg-[#fafafa] flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowProductionGuidePopup(false)}
                className="w-full py-2.5 rounded-xl bg-[#1d1d1f] hover:bg-black text-white text-sm font-semibold transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
              >
                Yes, I will do my best
              </button>
            </div>
          </div>
        </div>
      )}

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
