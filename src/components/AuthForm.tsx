'use client';

import { useState, useRef, useEffect, ChangeEvent, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Mail, Lock, User, Eye, EyeOff, Phone, Globe, MapPin, ChevronLeft,
  Upload, FileText, Info, CheckCircle2, Loader2, AlertCircle, ChevronDown, Search,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { ApiService } from '@/services/api';

type Step = 1 | 2 | 3 | 4;

const inputClass =
  'w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-[#f5f5f7] text-[#1d1d1f] text-sm placeholder-[#a1a1a6] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/20 focus:border-[#1d1d1f] transition-all disabled:opacity-60';

const MAX_PDF_SIZE = 10 * 1024 * 1024;

// Step order: 1=Account, 2=Categories, 3=Profile, 4=Channel
const STEP_LABELS: Record<Step, string> = { 1: 'Account', 2: 'Categories', 3: 'Profile', 4: 'Channel' };

const ALL_CATEGORIES = [
  'Psychology', 'Philosophy', 'Knowledge', 'Explainer Videos', 'Historical',
  'Science Facts', 'Tech Updates', 'Book Summaries', 'Business Cases', 'Business Lessons',
  'Personal Finance', 'Leadership', 'Sales & Negotiation', 'Self Improvement', 'Relationships',
  'Parenting', 'Persuasion & Influence', 'Health & Nutrition', 'Motivation', 'Religion & Stories',
  'Manifestation', 'Mythology', 'Crime Stories', 'Conspiracy & Myths', 'Mental Health',
  'Cultural Stories', 'Biographies', 'News', 'Geopolitics', 'Policy & Governance',
  'Legal Breakdowns', 'Criminal Insights', 'Legal Rights', 'Future Tech', 'Science & Tech',
];

const ALL_LANGUAGES = [
  'English', 'Hindi', 'Bengali', 'Telugu', 'Marathi', 'Tamil', 'Urdu',
  'Gujarati', 'Kannada', 'Odia', 'Malayalam', 'Punjabi', 'Assamese',
  'Maithili', 'Sanskrit', 'Santali', 'Kashmiri', 'Nepali', 'Sindhi',
  'Konkani', 'Manipuri', 'Bodo', 'Dogri',
];

export default function AuthForm() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [step, setStep] = useState<Step>(1);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: '', email: '', password: '', confirmPassword: '',
    phone: '', youtubeLink: '', instagramLink: '',
    facebookLink: '', twitterLink: '', billingAddress: '',
  });

  // Categories + language (step 2)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState('');
  const [langSearch, setLangSearch] = useState('');
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Channel memory (step 4)
  const [channelFile, setChannelFile] = useState<File | null>(null);
  const [channelFileError, setChannelFileError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [existingSummary, setExistingSummary] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const router = useRouter();

  // Close language dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
        setLangSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredLanguages = ALL_LANGUAGES.filter(l =>
    l.toLowerCase().includes(langSearch.toLowerCase())
  );

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : prev.length >= 3 ? prev : [...prev, cat]
    );
  };

  // Step 1 → Step 2
  const handleStep1Continue = (e: FormEvent) => {
    e.preventDefault();
    setMessage({ text: '', type: '' });
    if (formData.password !== formData.confirmPassword) {
      setMessage({ text: 'Passwords do not match.', type: 'error' });
      return;
    }
    if (formData.password.length < 6) {
      setMessage({ text: 'Password must be at least 6 characters.', type: 'error' });
      return;
    }
    setStep(2);
  };

  // Step 2 → Step 3
  const handleStep2Continue = () => {
    setMessage({ text: '', type: '' });
    setStep(3);
  };

  // Step 3 → Step 4
  const handleStep3Continue = (e: FormEvent) => {
    e.preventDefault();
    setMessage({ text: '', type: '' });
    setStep(4);
  };

  const validateAndSetFile = (file: File) => {
    setChannelFileError(null);
    setUploadStatus('idle');
    setUploadError(null);
    if (file.type !== 'application/pdf') { setChannelFileError('Only PDF files are accepted.'); setChannelFile(null); return; }
    if (file.size > MAX_PDF_SIZE) { setChannelFileError('File exceeds the 10 MB limit.'); setChannelFile(null); return; }
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

  const handleFinalSubmit = async (skipUpload = false) => {
    setIsLoading(true);
    setMessage({ text: '', type: '' });
    try {
      const data = await ApiService.signUp({
        email: formData.email,
        password: formData.password,
        full_name: formData.name,
        phone: formData.phone || undefined,
        youtube_link: formData.youtubeLink || undefined,
        instagram_link: formData.instagramLink || undefined,
        facebook_link: formData.facebookLink || undefined,
        twitter_link: formData.twitterLink || undefined,
        billing_address: formData.billingAddress || undefined,
        categories: selectedCategories.length > 0 ? selectedCategories : undefined,
      });

      if (data.user) {
        const { data: cpData } = await supabase
          .from('Channel_Profile').select('summary').eq('user_id', data.user.id).maybeSingle();
        setExistingSummary(cpData?.summary ?? null);
      }

      if (!skipUpload && channelFile && data.session) {
        setUploadStatus('uploading');
        const uploadForm = new FormData();
        uploadForm.append('file', channelFile);
        uploadForm.append('userId', data.user!.id);
        const res = await fetch('https://storybit-backend.onrender.com/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${data.session.access_token}` },
          body: uploadForm,
        });
        setUploadStatus(res.ok ? 'success' : 'error');
        if (!res.ok) setUploadError('Upload failed. You can re-upload from your Profile later.');
      }

      setMessage({ text: 'Account created! Check your email to confirm.', type: 'success' });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Something went wrong.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage({ text: '', type: '' });
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: formData.email, password: formData.password });
      if (error) throw error;
      router.push('/');
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Something went wrong.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback`, queryParams: { access_type: 'offline', prompt: 'consent' } },
      });
      if (error) throw error;
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Google Sign-in failed.', type: 'error' });
      setIsLoading(false);
    }
  };

  const switchMode = () => { setIsSignUp(v => !v); setStep(1); setMessage({ text: '', type: '' }); };

  // ── Sign-in ──────────────────────────────────────────────────────────────
  const signInForm = (
    <form onSubmit={handleSignIn} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5">Email</label>
        <div className="relative">
          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6e6e73] w-4 h-4" />
          <input name="email" type="email" placeholder="you@example.com" value={formData.email} onChange={handleInputChange} required disabled={isLoading} className={inputClass} />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5">Password</label>
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6e6e73] w-4 h-4" />
          <input name="password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={formData.password} onChange={handleInputChange} required disabled={isLoading} className={`${inputClass} pr-10`} />
          <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#6e6e73]">
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <button type="submit" disabled={isLoading} className="w-full py-2.5 rounded-xl bg-[#1d1d1f] hover:bg-black text-white text-sm font-medium transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 mt-1">
        {isLoading ? 'Signing in…' : 'Sign In'}
      </button>
    </form>
  );

  // ── Step 1: Account (name, email, password, phone) ───────────────────────
  const signUpStep1 = (
    <form onSubmit={handleStep1Continue} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5">Full Name</label>
        <div className="relative">
          <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6e6e73] w-4 h-4" />
          <input name="name" type="text" placeholder="Your full name" value={formData.name} onChange={handleInputChange} required disabled={isLoading} className={inputClass} />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5">Email</label>
        <div className="relative">
          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6e6e73] w-4 h-4" />
          <input name="email" type="email" placeholder="you@example.com" value={formData.email} onChange={handleInputChange} required disabled={isLoading} className={inputClass} />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5">Phone <span className="text-red-500">*</span></label>
        <div className="relative">
          <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6e6e73] w-4 h-4" />
          <input name="phone" type="tel" placeholder="+91 98765 43210" value={formData.phone} onChange={handleInputChange} required disabled={isLoading} className={inputClass} />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5">Password</label>
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6e6e73] w-4 h-4" />
          <input name="password" type={showPassword ? 'text' : 'password'} placeholder="Min 6 characters" value={formData.password} onChange={handleInputChange} required disabled={isLoading} className={`${inputClass} pr-10`} />
          <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#6e6e73]">
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5">Confirm Password</label>
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6e6e73] w-4 h-4" />
          <input name="confirmPassword" type="password" placeholder="••••••••" value={formData.confirmPassword} onChange={handleInputChange} required disabled={isLoading} className={inputClass} />
        </div>
      </div>
      <button type="submit" disabled={isLoading} className="w-full py-2.5 rounded-xl bg-[#1d1d1f] hover:bg-black text-white text-sm font-medium transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 mt-1">
        Continue →
      </button>
    </form>
  );

  // ── Step 2: Categories + Language ────────────────────────────────────────
  const signUpStep2 = (
    <div className="space-y-5">

      {/* Primary Language */}
      <div>
        <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5">
          What is your primary language? <span className="text-red-500">*</span>
        </label>
        <div ref={langRef} className="relative">
          {/* Trigger */}
          <div
            onClick={() => { setLangOpen(v => !v); setLangSearch(''); }}
            className="w-full flex items-center gap-2 pl-3.5 pr-4 py-2.5 rounded-xl border border-gray-200 bg-[#f5f5f7] text-sm cursor-pointer hover:border-gray-300 transition-all"
          >
            <Globe className="w-4 h-4 text-[#6e6e73] flex-shrink-0" />
            <span className={selectedLanguage ? 'text-[#1d1d1f] flex-1' : 'text-[#a1a1a6] flex-1'}>
              {selectedLanguage || 'Select a language'}
            </span>
            <ChevronDown className={`w-4 h-4 text-[#6e6e73] transition-transform duration-150 ${langOpen ? 'rotate-180' : ''}`} />
          </div>

          {/* Dropdown */}
          {langOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
              {/* Search input */}
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
              {/* Options list */}
              <div className="max-h-44 overflow-y-auto">
                {filteredLanguages.length > 0 ? (
                  filteredLanguages.map(lang => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => { setSelectedLanguage(lang); setLangOpen(false); setLangSearch(''); }}
                      className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                        selectedLanguage === lang
                          ? 'bg-[#1d1d1f] text-white'
                          : 'text-[#1d1d1f] hover:bg-[#f5f5f7]'
                      }`}
                    >
                      {lang}
                    </button>
                  ))
                ) : (
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
                onClick={() => !disabled && toggleCategory(cat)}
                className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all duration-150 ${
                  selected
                    ? 'bg-[#1d1d1f] text-white border-[#1d1d1f]'
                    : disabled
                    ? 'bg-white text-gray-300 border-gray-100 cursor-not-allowed'
                    : 'bg-white text-[#1d1d1f] border-gray-200 hover:border-[#1d1d1f] hover:bg-[#f5f5f7]'
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
        onClick={handleStep2Continue}
        disabled={!selectedLanguage || isLoading}
        className="w-full py-2.5 rounded-xl bg-[#1d1d1f] hover:bg-black text-white text-sm font-medium transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
      >
        Continue →
      </button>
      {!selectedLanguage && (
        <p className="text-center text-[11px] text-[#6e6e73]">Please select a language to continue</p>
      )}
      {selectedLanguage && selectedCategories.length === 0 && (
        <button type="button" onClick={handleStep2Continue} className="w-full py-1.5 text-xs text-[#6e6e73] hover:text-[#1d1d1f] transition-colors">
          Skip categories
        </button>
      )}
    </div>
  );

  // ── Step 3: Profile (social links + address, no phone) ───────────────────
  type ProfileField = {
    name: keyof typeof formData;
    label: string;
    placeholder: string;
    type: string;
    Icon: React.ComponentType<{ className?: string }>;
  };

  const profileFields: ProfileField[] = [
    { name: 'youtubeLink',    label: 'YouTube',         placeholder: 'https://youtube.com/@handle',     type: 'url',  Icon: Globe },
    { name: 'instagramLink',  label: 'Instagram',       placeholder: 'https://instagram.com/handle',    type: 'url',  Icon: Globe },
    { name: 'facebookLink',   label: 'Facebook',        placeholder: 'https://facebook.com/handle',     type: 'url',  Icon: Globe },
    { name: 'twitterLink',    label: 'X / Twitter',     placeholder: 'https://twitter.com/handle',      type: 'url',  Icon: Globe },
    { name: 'billingAddress', label: 'Billing Address', placeholder: '123 Main St, New York, NY 10001', type: 'text', Icon: MapPin },
  ];

  const signUpStep3 = (
    <form onSubmit={handleStep3Continue} className="space-y-3">
      {profileFields.map(({ name, label, placeholder, type, Icon }) => (
        <div key={name}>
          <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5">{label}</label>
          <div className="relative">
            <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6e6e73] w-4 h-4" />
            <input name={name} type={type} placeholder={placeholder} value={formData[name]} onChange={handleInputChange} disabled={isLoading} className={inputClass} />
          </div>
        </div>
      ))}
      <p className="text-[11px] text-[#6e6e73] pt-1">All fields are optional — you can fill them in later from your profile.</p>
      <button type="submit" disabled={isLoading} className="w-full py-2.5 rounded-xl bg-[#1d1d1f] hover:bg-black text-white text-sm font-medium transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 mt-1">
        Continue →
      </button>
    </form>
  );

  // ── Step 4: Channel memory ───────────────────────────────────────────────
  const signUpStep4 = (
    <div className="space-y-4">
      <div className="bg-[#f5f5f7] rounded-2xl p-4 flex gap-3">
        <Info className="w-4 h-4 text-[#6e6e73] flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-[#1d1d1f] mb-2">What to include in your PDF</p>
          <ul className="space-y-1">
            {[
              'Your speaking tone — casual, formal, storytelling, educational',
              'Signature phrases, catchphrases, or intros you always use',
              'Vocabulary style — simple, technical, regional expressions',
              'Target audience — age group, interests, background',
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

      {existingSummary && uploadStatus !== 'success' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            A channel profile is already on file — you can replace it below.
          </div>
          <div className="bg-[#f5f5f7] rounded-xl p-3">
            <p className="text-[10px] font-semibold text-[#6e6e73] uppercase tracking-widest mb-1">Current summary</p>
            <p className="text-xs text-[#1d1d1f] leading-relaxed whitespace-pre-wrap line-clamp-4">{existingSummary}</p>
          </div>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleFileChange} />

      {uploadStatus !== 'success' && (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 ${
            isDragOver ? 'border-[#1d1d1f] bg-gray-50'
              : channelFile ? 'border-green-300 bg-green-50/40'
              : channelFileError ? 'border-red-300 bg-red-50/30'
              : 'border-gray-200 hover:border-gray-300 hover:bg-[#f5f5f7]/60'
          }`}
        >
          {channelFile ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-2xl bg-green-100 border border-green-200 flex items-center justify-center">
                <FileText className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#1d1d1f]">{channelFile.name}</p>
                <p className="text-[11px] text-[#6e6e73] mt-0.5">{(channelFile.size / 1024 / 1024).toFixed(2)} MB · PDF</p>
              </div>
              <button onClick={e => { e.stopPropagation(); setChannelFile(null); setUploadStatus('idle'); setUploadError(null); }} className="text-[11px] text-[#6e6e73] hover:text-red-500 underline transition-colors">
                Remove file
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center transition-colors ${isDragOver ? 'bg-[#1d1d1f] border-[#1d1d1f]' : 'bg-white border-gray-200'}`}>
                <Upload className={`w-4 h-4 transition-colors ${isDragOver ? 'text-white' : 'text-[#6e6e73]'}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-[#1d1d1f]">{isDragOver ? 'Drop it here' : 'Drop your PDF here'}</p>
                <p className="text-[11px] text-[#6e6e73] mt-0.5">or <span className="underline">click to browse</span> · PDF only · max 10 MB</p>
              </div>
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
          <div className="text-center">
            <p className="text-sm font-semibold text-[#1d1d1f]">Profile uploaded successfully</p>
            <p className="text-[11px] text-[#6e6e73] mt-0.5">Your channel style guide is now active.</p>
          </div>
        </div>
      )}

      {uploadStatus !== 'success' && (
        <button type="button" onClick={() => handleFinalSubmit(false)} disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#1d1d1f] hover:bg-black text-white text-sm font-medium transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50">
          {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Creating account…</> : 'Create Account'}
        </button>
      )}
      {uploadStatus !== 'success' && (
        <button type="button" onClick={() => handleFinalSubmit(true)} disabled={isLoading}
          className="w-full py-2 text-xs text-[#6e6e73] hover:text-[#1d1d1f] transition-colors">
          I'll do it later (skip)
        </button>
      )}
    </div>
  );

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-3xl shadow-xl shadow-black/[0.08] border border-gray-200/80 overflow-hidden">

        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b border-gray-100">
          {isSignUp && step > 1 && (
            <button type="button"
              onClick={() => { setStep((step - 1) as Step); setMessage({ text: '', type: '' }); }}
              className="flex items-center gap-1 text-xs text-[#6e6e73] hover:text-[#1d1d1f] mb-4 transition-colors">
              <ChevronLeft className="w-3.5 h-3.5" /> Back
            </button>
          )}

          {/* Step indicator */}
          {isSignUp && (
            <div className="flex items-center gap-1.5 mb-4 overflow-x-auto">
              {([1, 2, 3, 4] as Step[]).map((s, idx) => (
                <div key={s} className="flex items-center gap-1.5 flex-shrink-0">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold transition-all ${
                    s === step ? 'bg-[#1d1d1f] text-white' : s < step ? 'bg-green-500 text-white' : 'bg-gray-100 text-[#6e6e73]'
                  }`}>
                    {s < step ? '✓' : s}
                  </div>
                  <span className={`text-[10px] font-medium ${s === step ? 'text-[#1d1d1f]' : 'text-[#6e6e73]'}`}>
                    {STEP_LABELS[s]}
                  </span>
                  {idx < 3 && <div className="w-4 h-px bg-gray-200" />}
                </div>
              ))}
            </div>
          )}

          <div className="text-center">
            <h1 className="text-2xl font-semibold text-[#1d1d1f] mb-1 tracking-tight"
              style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}>
              {!isSignUp ? 'Welcome back'
                : step === 1 ? 'Create your account'
                : step === 2 ? 'Your content niche'
                : step === 3 ? 'Your profile'
                : 'Channel memory'}
            </h1>
            <p className="text-sm text-[#6e6e73] font-light">
              {!isSignUp ? 'Sign in to continue to Storybit'
                : step === 1 ? 'Start creating research-backed YouTube scripts'
                : step === 2 ? 'Tell us about your content & preferred language'
                : step === 3 ? 'Add your social links (optional)'
                : 'Upload your channel style guide so AI writes scripts that sound like you'}
            </p>
          </div>
        </div>

        <div className="px-8 py-6 space-y-5">
          {/* Google (step 1 only) */}
          {(!isSignUp || step === 1) && (
            <>
              <button type="button" onClick={handleGoogleSignIn} disabled={isLoading}
                className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-[#1d1d1f] text-sm font-medium transition-all duration-200 disabled:opacity-50">
                <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-100" /></div>
                <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-[#6e6e73]">or</span></div>
              </div>
            </>
          )}

          {message.text && (
            <div className={`text-xs text-center px-4 py-2.5 rounded-xl ${
              message.type === 'error' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-green-50 text-green-700 border border-green-100'
            }`}>{message.text}</div>
          )}

          {!isSignUp && signInForm}
          {isSignUp && step === 1 && signUpStep1}
          {isSignUp && step === 2 && signUpStep2}
          {isSignUp && step === 3 && signUpStep3}
          {isSignUp && step === 4 && signUpStep4}

          <div className="text-center space-y-2">
            <p className="text-xs text-[#6e6e73]">
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button type="button" onClick={switchMode} className="text-[#1d1d1f] font-medium hover:underline" disabled={isLoading}>
                {isSignUp ? 'Sign In' : 'Sign Up'}
              </button>
            </p>
            {!isSignUp && (
              <Link href="/forgot-password" className="text-xs text-[#6e6e73] hover:text-[#1d1d1f] transition-colors">
                Forgot your password?
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
