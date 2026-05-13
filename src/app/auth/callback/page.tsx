'use client';

import { useState, useRef, useEffect, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2, Globe, MapPin, ChevronLeft, ChevronDown, Search,
  Upload, FileText, Info, AlertCircle, CheckCircle2,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import Header from '@/components/Header';

type CBStep = 1 | 2 | 3;
type AppStatus = 'loading' | 'form' | 'redirecting';

const STEP_LABELS: Record<CBStep, string> = { 1: 'Categories', 2: 'Profile', 3: 'Channel' };

const ALL_LANGUAGES = [
  'English', 'Hindi', 'Bengali', 'Telugu', 'Marathi', 'Tamil', 'Urdu',
  'Gujarati', 'Kannada', 'Odia', 'Malayalam', 'Punjabi', 'Assamese',
  'Maithili', 'Sanskrit', 'Santali', 'Kashmiri', 'Nepali', 'Sindhi',
  'Konkani', 'Manipuri', 'Bodo', 'Dogri',
  'Spanish', 'French', 'German', 'Arabic', 'Portuguese', 'Russian',
  'Japanese', 'Korean', 'Chinese (Mandarin)', 'Italian', 'Dutch',
];

const ALL_CATEGORIES = [
  'Psychology', 'Philosophy', 'Knowledge', 'Explainer Videos', 'Historical',
  'Science Facts', 'Tech Updates', 'Book Summaries', 'Business Cases', 'Business Lessons',
  'Personal Finance', 'Leadership', 'Sales & Negotiation', 'Self Improvement', 'Relationships',
  'Parenting', 'Persuasion & Influence', 'Health & Nutrition', 'Motivation', 'Religion & Stories',
  'Manifestation', 'Mythology', 'Crime Stories', 'Conspiracy & Myths', 'Mental Health',
  'Cultural Stories', 'Biographies', 'News', 'Geopolitics', 'Policy & Governance',
  'Legal Breakdowns', 'Criminal Insights', 'Legal Rights', 'Future Tech', 'Science & Tech',
];

const MAX_PDF_SIZE = 10 * 1024 * 1024;

const inputClass =
  'w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-[#f5f5f7] text-[#1d1d1f] text-sm placeholder-[#a1a1a6] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/20 focus:border-[#1d1d1f] transition-all disabled:opacity-60';

type ProfileForm = {
  youtubeLink: string;
  instagramLink: string;
  facebookLink: string;
  twitterLink: string;
  billingAddress: string;
};

export default function AuthCallback() {
  const router = useRouter();
  const [status, setStatus]   = useState<AppStatus>('loading');
  const [cbStep, setCbStep]   = useState<CBStep>(1);
  const [userId, setUserId]   = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError]     = useState('');

  // Step 1 — language + categories
  const [selectedLanguage, setSelectedLanguage]     = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [langOpen, setLangOpen]   = useState(false);
  const [langSearch, setLangSearch] = useState('');
  const langRef = useRef<HTMLDivElement>(null);

  // Step 2 — social links
  const [profileForm, setProfileForm] = useState<ProfileForm>({
    youtubeLink: '', instagramLink: '', facebookLink: '', twitterLink: '', billingAddress: '',
  });

  // Step 3 — channel PDF
  const [channelFile, setChannelFile]     = useState<File | null>(null);
  const [channelFileError, setChannelFileError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver]       = useState(false);
  const [uploadStatus, setUploadStatus]   = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadError, setUploadError]     = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close language dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Init: get session, upsert base profile, check if already onboarded
  useEffect(() => {
    const init = async () => {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        router.replace('/auth');
        return;
      }

      const user = session.user;
      setUserId(user.id);
      setAccessToken(session.access_token);

      // Upsert base profile (email + display name from metadata)
      const fullName =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split('@')[0] || '';

      await supabase.from('profiles').upsert(
        { id: user.id, email: user.email ?? '', full_name: fullName, updated_at: new Date().toISOString() },
        { onConflict: 'id' }
      );

      // If primary_language is already set → onboarding was completed → go to app
      const { data: existing } = await supabase
        .from('profiles')
        .select('primary_language')
        .eq('id', user.id)
        .single();

      if (existing?.primary_language) {
        setStatus('redirecting');
        router.replace('/');
        return;
      }

      setStatus('form');
    };
    init();
  }, [router]);

  // ── Step 1 submit: save language + categories ────────────────────────────
  const handleStep1 = async () => {
    if (!selectedLanguage) return;
    setIsSaving(true);
    setError('');
    try {
      const { error: err } = await supabase.from('profiles').upsert(
        {
          id:               userId,
          primary_language: selectedLanguage,
          categories:       selectedCategories.length > 0 ? selectedCategories : null,
          updated_at:       new Date().toISOString(),
        },
        { onConflict: 'id' }
      );
      if (err) throw err;
      setCbStep(2);
    } catch (e: any) {
      setError(e?.message || 'Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Step 2 submit: save social links ─────────────────────────────────────
  const handleStep2 = async (skip = false) => {
    setIsSaving(true);
    setError('');
    try {
      if (!skip) {
        const { error: err } = await supabase.from('profiles').upsert(
          {
            id:               userId,
            youtube_link:     profileForm.youtubeLink     || null,
            instagram_link:   profileForm.instagramLink   || null,
            facebook_link:    profileForm.facebookLink    || null,
            twitter_link:     profileForm.twitterLink     || null,
            billing_address:  profileForm.billingAddress  || null,
            updated_at:       new Date().toISOString(),
          },
          { onConflict: 'id' }
        );
        if (err) throw err;
      }
      setCbStep(3);
    } catch (e: any) {
      setError(e?.message || 'Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Step 3 submit: upload PDF (optional) then finish ─────────────────────
  const handleStep3 = async (skipUpload = false) => {
    setIsSaving(true);
    setError('');
    try {
      if (!skipUpload && channelFile) {
        setUploadStatus('uploading');
        const uploadForm = new FormData();
        uploadForm.append('file', channelFile);
        uploadForm.append('userId', userId);
        const res = await fetch('https://storybit-backend.onrender.com/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
          body: uploadForm,
        });
        if (!res.ok) {
          setUploadStatus('error');
          setUploadError('Upload failed. You can re-upload from your Profile later.');
          setIsSaving(false);
          return;
        }
        setUploadStatus('success');
      }
      setStatus('redirecting');
      router.replace('/');
    } catch (e: any) {
      setError(e?.message || 'Something went wrong.');
      setIsSaving(false);
    }
  };

  // ── File helpers ──────────────────────────────────────────────────────────
  const validateAndSetFile = (file: File) => {
    setChannelFileError(null);
    setUploadStatus('idle');
    setUploadError(null);
    if (file.type !== 'application/pdf') { setChannelFileError('Only PDF files are accepted.'); return; }
    if (file.size > MAX_PDF_SIZE)         { setChannelFileError('File exceeds the 10 MB limit.'); return; }
    setChannelFile(file);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) validateAndSetFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) validateAndSetFile(file);
  };

  // ── Loading / redirecting ─────────────────────────────────────────────────
  if (status === 'loading' || status === 'redirecting') {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-7 h-7 animate-spin text-[#1d1d1f]" />
          <p className="text-sm text-[#6e6e73] font-light">
            {status === 'loading' ? 'Setting up your account…' : 'Taking you in…'}
          </p>
        </div>
      </div>
    );
  }

  const filteredLanguages = ALL_LANGUAGES.filter(l =>
    l.toLowerCase().includes(langSearch.toLowerCase())
  );

  // ── Onboarding form ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <Header />

      <div className="flex items-center justify-center px-4 sm:px-6 py-10 sm:py-16">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-xl shadow-black/[0.08] border border-gray-200/80 overflow-hidden">

            {/* Card header */}
            <div className="px-8 pt-8 pb-6 border-b border-gray-100">
              {cbStep > 1 && (
                <button
                  type="button"
                  onClick={() => { setCbStep((cbStep - 1) as CBStep); setError(''); }}
                  className="flex items-center gap-1 text-xs text-[#6e6e73] hover:text-[#1d1d1f] mb-4 transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Back
                </button>
              )}

              {/* Step indicator */}
              <div className="flex items-center gap-1.5 mb-4">
                {([1, 2, 3] as CBStep[]).map((s, idx) => (
                  <div key={s} className="flex items-center gap-1.5 flex-shrink-0">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold transition-all ${
                      s === cbStep ? 'bg-[#1d1d1f] text-white' : s < cbStep ? 'bg-green-500 text-white' : 'bg-gray-100 text-[#6e6e73]'
                    }`}>
                      {s < cbStep ? '✓' : s}
                    </div>
                    <span className={`text-[10px] font-medium ${s === cbStep ? 'text-[#1d1d1f]' : 'text-[#6e6e73]'}`}>
                      {STEP_LABELS[s]}
                    </span>
                    {idx < 2 && <div className="w-4 h-px bg-gray-200" />}
                  </div>
                ))}
              </div>

              <div className="text-center">
                <h1
                  className="text-2xl font-semibold text-[#1d1d1f] mb-1 tracking-tight"
                  style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}
                >
                  {cbStep === 1 ? 'Your content niche' : cbStep === 2 ? 'Your profile' : 'Channel memory'}
                </h1>
                <p className="text-sm text-[#6e6e73] font-light">
                  {cbStep === 1
                    ? 'Tell us about your content & preferred language'
                    : cbStep === 2
                    ? 'Add your social links (optional)'
                    : 'Upload your channel style guide so AI writes scripts that sound like you'}
                </p>
              </div>
            </div>

            <div className="px-8 py-6 space-y-5">
              {error && (
                <div className="flex items-center gap-2 text-xs px-4 py-2.5 rounded-xl bg-red-50 text-red-600 border border-red-100">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
                </div>
              )}

              {/* ── Step 1: Language + Categories ──────────────────────── */}
              {cbStep === 1 && (
                <div className="space-y-5">
                  {/* Language picker */}
                  <div>
                    <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5">
                      Primary language <span className="text-red-500">*</span>
                    </label>
                    <div ref={langRef} className="relative">
                      <div
                        onClick={() => { setLangOpen(v => !v); setLangSearch(''); }}
                        className="w-full flex items-center gap-2 pl-3.5 pr-4 py-2.5 rounded-xl border border-gray-200 bg-[#f5f5f7] text-sm cursor-pointer hover:border-gray-300 transition-all"
                      >
                        <Globe className="w-4 h-4 text-[#6e6e73] flex-shrink-0" />
                        <span className={selectedLanguage ? 'text-[#1d1d1f] flex-1' : 'text-[#a1a1a6] flex-1'}>
                          {selectedLanguage || 'Select a language'}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-[#6e6e73] transition-transform ${langOpen ? 'rotate-180' : ''}`} />
                      </div>
                      {langOpen && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
                          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
                            <Search className="w-3.5 h-3.5 text-[#6e6e73] flex-shrink-0" />
                            <input
                              autoFocus
                              type="text"
                              placeholder="Search language…"
                              value={langSearch}
                              onChange={e => setLangSearch(e.target.value)}
                              className="flex-1 text-sm text-[#1d1d1f] bg-transparent outline-none placeholder-[#a1a1a6]"
                            />
                          </div>
                          <div className="max-h-44 overflow-y-auto">
                            {filteredLanguages.length > 0 ? filteredLanguages.map(lang => (
                              <button
                                key={lang}
                                type="button"
                                onClick={() => { setSelectedLanguage(lang); setLangOpen(false); setLangSearch(''); }}
                                className={`w-full text-left px-4 py-2 text-sm transition-colors ${selectedLanguage === lang ? 'bg-[#1d1d1f] text-white' : 'text-[#1d1d1f] hover:bg-[#f5f5f7]'}`}
                              >
                                {lang}
                              </button>
                            )) : (
                              <p className="px-4 py-3 text-xs text-[#6e6e73]">No languages found</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Categories */}
                  <div>
                    <p className="text-xs font-medium text-[#1d1d1f] mb-0.5">
                      Content categories{' '}
                      {selectedCategories.length > 0 && (
                        <span className="text-[#6e6e73] font-normal">({selectedCategories.length}/3 selected)</span>
                      )}
                    </p>
                    <p className="text-[11px] text-[#6e6e73] mb-3">Select up to 3 categories that best describe your content niche.</p>
                    <div className="flex flex-wrap gap-2 max-h-52 overflow-y-auto pr-0.5">
                      {ALL_CATEGORIES.map(cat => {
                        const selected = selectedCategories.includes(cat);
                        const disabled = !selected && selectedCategories.length >= 3;
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => {
                              if (disabled) return;
                              setSelectedCategories(prev =>
                                prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
                              );
                            }}
                            className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                              selected   ? 'bg-[#1d1d1f] text-white border-[#1d1d1f]'
                              : disabled ? 'bg-white text-gray-300 border-gray-100 cursor-not-allowed'
                              :            'bg-white text-[#1d1d1f] border-gray-200 hover:border-[#1d1d1f] hover:bg-[#f5f5f7]'
                            }`}
                          >
                            {cat}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleStep1}
                    disabled={!selectedLanguage || isSaving}
                    className="w-full py-2.5 rounded-xl bg-[#1d1d1f] hover:bg-black text-white text-sm font-medium transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : 'Continue →'}
                  </button>
                  {!selectedLanguage && (
                    <p className="text-center text-[11px] text-[#6e6e73]">Please select a language to continue</p>
                  )}
                  {selectedLanguage && selectedCategories.length === 0 && (
                    <button type="button" onClick={handleStep1} disabled={isSaving} className="w-full py-1.5 text-xs text-[#6e6e73] hover:text-[#1d1d1f] transition-colors">
                      Skip categories
                    </button>
                  )}
                </div>
              )}

              {/* ── Step 2: Social links ──────────────────────────────── */}
              {cbStep === 2 && (
                <div className="space-y-3">
                  {[
                    { name: 'youtubeLink'   as const, label: 'YouTube',          placeholder: 'https://youtube.com/@handle'  },
                    { name: 'instagramLink' as const, label: 'Instagram',         placeholder: 'https://instagram.com/handle' },
                    { name: 'facebookLink'  as const, label: 'Facebook',          placeholder: 'https://facebook.com/handle'  },
                    { name: 'twitterLink'   as const, label: 'X / Twitter',       placeholder: 'https://twitter.com/handle'   },
                    { name: 'billingAddress'as const, label: 'Billing Address',   placeholder: '123 Main St, City'            },
                  ].map(({ name, label, placeholder }) => (
                    <div key={name}>
                      <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5">{label}</label>
                      <div className="relative">
                        <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6e6e73] w-4 h-4" />
                        <input
                          name={name}
                          type={name === 'billingAddress' ? 'text' : 'url'}
                          placeholder={placeholder}
                          value={profileForm[name]}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => setProfileForm(prev => ({ ...prev, [name]: e.target.value }))}
                          disabled={isSaving}
                          className={inputClass}
                        />
                      </div>
                    </div>
                  ))}
                  <p className="text-[11px] text-[#6e6e73] pt-1">All fields are optional — fill them in later from your profile.</p>
                  <button
                    type="button"
                    onClick={() => handleStep2(false)}
                    disabled={isSaving}
                    className="w-full py-2.5 rounded-xl bg-[#1d1d1f] hover:bg-black text-white text-sm font-medium transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : 'Continue →'}
                  </button>
                  <button type="button" onClick={() => handleStep2(true)} disabled={isSaving} className="w-full py-1.5 text-xs text-[#6e6e73] hover:text-[#1d1d1f] transition-colors">
                    Skip for now
                  </button>
                </div>
              )}

              {/* ── Step 3: Channel memory ────────────────────────────── */}
              {cbStep === 3 && (
                <div className="space-y-4">
                  <div className="bg-[#f5f5f7] rounded-2xl p-4 flex gap-3">
                    <Info className="w-4 h-4 text-[#6e6e73] flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-[#1d1d1f] mb-2">What to include in your PDF</p>
                      <ul className="space-y-1">
                        {[
                          'Your speaking tone — casual, formal, storytelling',
                          'Signature phrases or intros you always use',
                          'Target audience — age group, interests',
                          'Content approach — data-driven, narrative, opinion-led',
                          'Topics or niches you cover most',
                        ].map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-[11px] text-[#6e6e73]">
                            <span className="w-1 h-1 rounded-full bg-[#6e6e73] flex-shrink-0 mt-1.5" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleFileChange} />

                  {uploadStatus !== 'success' && (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
                      onDragLeave={() => setIsDragOver(false)}
                      onDrop={handleDrop}
                      className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                        isDragOver    ? 'border-[#1d1d1f] bg-gray-50'
                        : channelFile  ? 'border-green-300 bg-green-50/40'
                        : channelFileError ? 'border-red-300 bg-red-50/30'
                        :                'border-gray-200 hover:border-gray-300 hover:bg-[#f5f5f7]/60'
                      }`}
                    >
                      {channelFile ? (
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-10 h-10 rounded-2xl bg-green-100 border border-green-200 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-green-600" />
                          </div>
                          <p className="text-sm font-semibold text-[#1d1d1f]">{channelFile.name}</p>
                          <p className="text-[11px] text-[#6e6e73]">{(channelFile.size / 1024 / 1024).toFixed(2)} MB · PDF</p>
                          <button
                            onClick={e => { e.stopPropagation(); setChannelFile(null); setUploadStatus('idle'); setUploadError(null); }}
                            className="text-[11px] text-[#6e6e73] hover:text-red-500 underline"
                          >
                            Remove file
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center ${isDragOver ? 'bg-[#1d1d1f] border-[#1d1d1f]' : 'bg-white border-gray-200'}`}>
                            <Upload className={`w-4 h-4 ${isDragOver ? 'text-white' : 'text-[#6e6e73]'}`} />
                          </div>
                          <p className="text-sm font-medium text-[#1d1d1f]">{isDragOver ? 'Drop it here' : 'Drop your PDF here'}</p>
                          <p className="text-[11px] text-[#6e6e73]">or <span className="underline">click to browse</span> · PDF only · max 10 MB</p>
                        </div>
                      )}
                    </div>
                  )}

                  {channelFileError && (
                    <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />{channelFileError}
                    </div>
                  )}
                  {uploadStatus === 'error' && uploadError && (
                    <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />{uploadError}
                    </div>
                  )}
                  {uploadStatus === 'success' && (
                    <div className="flex flex-col items-center gap-3 py-3">
                      <div className="w-12 h-12 rounded-full bg-green-100 border border-green-200 flex items-center justify-center">
                        <CheckCircle2 className="w-6 h-6 text-green-600" />
                      </div>
                      <p className="text-sm font-semibold text-[#1d1d1f]">Profile uploaded successfully</p>
                    </div>
                  )}

                  {uploadStatus !== 'success' && (
                    <button
                      type="button"
                      onClick={() => handleStep3(false)}
                      disabled={isSaving}
                      className="w-full py-2.5 rounded-xl bg-[#1d1d1f] hover:bg-black text-white text-sm font-medium transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isSaving
                        ? <><Loader2 className="w-4 h-4 animate-spin" />{uploadStatus === 'uploading' ? 'Uploading…' : 'Finishing…'}</>
                        : channelFile ? 'Upload & Finish' : 'Finish Setup'}
                    </button>
                  )}
                  {uploadStatus === 'success' && (
                    <button
                      type="button"
                      onClick={() => handleStep3(true)}
                      disabled={isSaving}
                      className="w-full py-2.5 rounded-xl bg-[#1d1d1f] hover:bg-black text-white text-sm font-medium transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
                    >
                      {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" />Taking you in…</> : 'Go to Storybit →'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleStep3(true)}
                    disabled={isSaving}
                    className="w-full py-1.5 text-xs text-[#6e6e73] hover:text-[#1d1d1f] transition-colors"
                  >
                    Skip — I&apos;ll do it later
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
