"use client";

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { User, Edit, Save, FileText, CreditCard, Crown, Calendar, DollarSign, Download, ExternalLink, LogOut, Menu, X, Video, Upload, CheckCircle2, AlertCircle, Loader2, FileIcon, Info, Lock, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

type ProfileData = {
  name: string;
  email: string;
  phone: string;
  youtubeLink: string;
  instagramLink: string;
  facebookLink: string;
  twitterLink: string;
  billingAddress: string;
  primaryLanguage: string;
  categories: string[];
};

const emptyProfile: ProfileData = {
  name: '', email: '', phone: '',
  youtubeLink: '', instagramLink: '',
  facebookLink: '', twitterLink: '',
  billingAddress: '',
  primaryLanguage: '',
  categories: [],
};

const ALL_LANGUAGES = [
  'English', 'Hindi', 'Bengali', 'Telugu', 'Marathi', 'Tamil', 'Urdu',
  'Gujarati', 'Kannada', 'Odia', 'Malayalam', 'Punjabi', 'Assamese',
  'Maithili', 'Sanskrit', 'Santali', 'Kashmiri', 'Nepali', 'Sindhi',
  'Konkani', 'Manipuri', 'Bodo', 'Dogri',
];

const ALL_CATEGORIES = [
  'Psychology', 'Philosophy', 'Knowledge', 'Explainer Videos', 'Historical',
  'Science Facts', 'Tech Updates', 'Book Summaries', 'Business Cases', 'Business Lessons',
  'Personal Finance', 'Leadership', 'Sales & Negotiation', 'Self Improvement', 'Relationships',
  'Health & Fitness', 'Spirituality', 'Mythology', 'Politics & Society', 'Current Affairs',
  'Geopolitics', 'Environmental Issues', 'Space & Universe', 'AI & Machine Learning',
  'Legal Breakdowns', 'Criminal Insights', 'Legal Rights', 'Future Tech', 'Science & Tech',
];

export default function Profile() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('profile');
  const [isEditing, setIsEditing] = useState(false);
  const [profileData, setProfileData] = useState<ProfileData>(emptyProfile);
  const [editData, setEditData] = useState<ProfileData>(emptyProfile);
  const [isFetchingProfile, setIsFetchingProfile] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [langSearch, setLangSearch] = useState('');
  const langRef = useRef<HTMLDivElement>(null);

  // Close language dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Fetch profile from Supabase on mount
  useEffect(() => {
    const fetchProfile = async () => {
      setIsFetchingProfile(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { router.push('/auth'); return; }

        const user = session.user;
        const { data, error } = await supabase
          .from('user_profiles')
          .select('full_name, phone, youtube_link, instagram_link, facebook_link, twitter_link, billing_address, primary_language, categories')
          .eq('id', user.id)
          .single();

        const fetched: ProfileData = {
          name:            data?.full_name        ?? user.user_metadata?.full_name        ?? '',
          email:           user.email             ?? '',
          phone:           data?.phone            ?? user.user_metadata?.phone            ?? '',
          youtubeLink:     data?.youtube_link     ?? user.user_metadata?.youtube_link     ?? '',
          instagramLink:   data?.instagram_link   ?? user.user_metadata?.instagram_link   ?? '',
          facebookLink:    data?.facebook_link    ?? user.user_metadata?.facebook_link    ?? '',
          twitterLink:     data?.twitter_link     ?? user.user_metadata?.twitter_link     ?? '',
          billingAddress:  data?.billing_address  ?? user.user_metadata?.billing_address  ?? '',
          primaryLanguage: data?.primary_language ?? user.user_metadata?.primary_language ?? '',
          categories:
  Array.isArray(data?.categories)
    ? data.categories
    : typeof data?.categories === 'string'
    ? JSON.parse(data.categories)
    : [],
        };

        // Log the error only if it's something other than "no rows found"
        if (error && error.code !== 'PGRST116') {
          console.warn('[profile fetch]', error.message);
        }

        setProfileData(fetched);
        setEditData(fetched);
      } finally {
        setIsFetchingProfile(false);
      }
    };
    fetchProfile();
  }, [router]);

  // Channel PDF upload state
  const [channelFile, setChannelFile] = useState<File | null>(null);
  const [channelFileError, setChannelFileError] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Channel Profile — existing summary from Supabase
  const [channelSummary, setChannelSummary] = useState<string | null>(null);
  const [isLoadingChannel, setIsLoadingChannel] = useState(false);
  const [isReUploading, setIsReUploading] = useState(false);

  const MAX_PDF_SIZE = 10 * 1024 * 1024; // 10 MB

  // Fetch existing Channel_Profile when tab is opened
  useEffect(() => {
    if (activeTab !== 'channel') return;
    const fetchChannelProfile = async () => {
      setIsLoadingChannel(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const { data } = await supabase
          .from('user_channel_memory_input')
          .select('Summary')
          .eq('userId', session.user.id)
          .maybeSingle();
        setChannelSummary(data?.Summary ?? null);
      } finally {
        setIsLoadingChannel(false);
      }
    };
    fetchChannelProfile();
  }, [activeTab]);

  const validateAndSetFile = (file: File) => {
    setChannelFileError(null);
    setUploadStatus('idle');
    setUploadError(null);
    if (file.type !== 'application/pdf') {
      setChannelFileError('Only PDF files are accepted.');
      setChannelFile(null);
      return;
    }
    if (file.size > MAX_PDF_SIZE) {
      setChannelFileError('File exceeds the 10 MB limit.');
      setChannelFile(null);
      return;
    }
    setChannelFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const handleUpload = async () => {
    if (!channelFile) return;
  
    setUploadStatus('uploading');
    setUploadError(null);
  
    try {
      const { data: { session } } = await supabase.auth.getSession();
  
      if (!session) {
        throw new Error('Not authenticated');
      }
  
      const formData = new FormData();
      formData.append('file', channelFile);
      formData.append('userId', session.user.id);
  
      // ✅ Log request data
      console.log('Uploading Data:', {
        userId: session.user.id,
        fileName: channelFile.name,
        fileType: channelFile.type,
        fileSize: channelFile.size,
      });
  
      const res = await fetch('https://storybit-backend.onrender.com/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });
  
      // ✅ Log raw response
      console.log('Upload Response Status:', res.status);
  
      const responseData = await res.json().catch(async () => {
        const text = await res.text();
        return text;
      });
  
      // ✅ Log response body
      console.log('Upload Response Data:', responseData);
  
      if (!res.ok) {
        throw new Error(
          typeof responseData === 'string'
            ? responseData
            : responseData?.message || `Upload failed (${res.status})`
        );
      }
  
      setUploadStatus('success');
      setIsReUploading(false);
      // Refresh summary from Channel_Profile
      const { data: { session: s2 } } = await supabase.auth.getSession();
      if (s2) {
        const { data: cp } = await supabase
          .from('user_channel_memory_input')
          .select('Summary')
          .eq('userId', s2.user.id)
          .maybeSingle();
        setChannelSummary(cp?.Summary ?? null);
      }

    } catch (err: any) {
      console.error('Upload Error:', err);
  
      setUploadStatus('error');
      setUploadError(err?.message || 'Upload failed. Please try again.');
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('user_profiles')
        .upsert({
          id:               session.user.id,
          full_name:        editData.name,
          phone:            editData.phone,
          youtube_link:     editData.youtubeLink,
          instagram_link:   editData.instagramLink,
          facebook_link:    editData.facebookLink,
          twitter_link:     editData.twitterLink,
          billing_address:  editData.billingAddress,
          primary_language: editData.primaryLanguage || null,
          categories:       editData.categories.length > 0 ? editData.categories : null,
          updated_at:       new Date().toISOString(),
        }, { onConflict: 'id' });

      if (error) throw error;

      setProfileData(editData);
      setIsEditing(false);
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => { setEditData(profileData); setIsEditing(false); setSaveError(null); };
  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/auth'); };

  const downloadInvoice = (invoiceUrl: string | null) => {
    if (!invoiceUrl) return;
    // Open in new tab (browser will prompt download for PDF links)
    window.open(invoiceUrl, '_blank', 'noopener,noreferrer');
    // Also trigger a download via anchor
    const a = document.createElement('a');
    a.href = invoiceUrl;
    a.download = '';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // ── My Scripts state ─────────────────────────────────────────────────────
  type ScriptRow = {
    id: string;
    title: string | null;
    topic: string | null;
    estimated_word_count: number;
    status: string;
    created_at: string;
    is_public: boolean;
  };

  const [myScripts, setMyScripts] = useState<ScriptRow[]>([]);
  const [isLoadingScripts, setIsLoadingScripts] = useState(false);
  const [scriptsFetched, setScriptsFetched] = useState(false);

  useEffect(() => {
    if (activeTab !== 'scripts' || scriptsFetched) return;
    const fetchScripts = async () => {
      setIsLoadingScripts(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const { data, error } = await supabase
          .from('scripts_assigned')
          .select('id, title, topic, estimated_word_count, status, created_at, is_public')
          .eq('userId', session.user.id)
          .order('created_at', { ascending: false });
        if (!error && data) {
          setMyScripts(data as ScriptRow[]);
          setScriptsFetched(true);
        }
      } finally {
        setIsLoadingScripts(false);
      }
    };
    fetchScripts();
  }, [activeTab, scriptsFetched]);

  // ── Subscription / Billing state ──────────────────────────────────────────
  type SubscriptionRow = {
    id: number;
    userId: string;
    amount: number;
    plan: string;
    purchased_date: string;
    validity: string;
    credits: number;
    payment_status: string;
    rayzorpay_payment_id: string | null;
    razorpay_order_id: string | null;
    invoice_url: string | null;
  };

  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [isLoadingSub, setIsLoadingSub] = useState(false);
  const [subFetched, setSubFetched] = useState(false);
  const [freeTier, setFreeTier] = useState<{ plan: string; credits_remaining: number } | null>(null);

  useEffect(() => {
    if (activeTab !== 'subscription' && activeTab !== 'billing') return;
    if (subFetched) return;
    const fetchSubs = async () => {
      setIsLoadingSub(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const { data, error } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('userId', session.user.id)
          .order('purchased_date', { ascending: false });
        if (!error && data && data.length > 0) {
          setSubscriptions(data as SubscriptionRow[]);
        } else {
          // No subscription row — fall back to profiles table for free-tier info
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('user_tier, credits_remaining')
            .eq('id', session.user.id)
            .single();
          if (profile) {
            setFreeTier({
              plan:              profile.user_tier       ?? 'Free',
              credits_remaining: profile.credits_remaining ?? 0,
            });
          }
        }
        setSubFetched(true);
      } finally {
        setIsLoadingSub(false);
      }
    };
    fetchSubs();
  }, [activeTab, subFetched]);

  // Derive display values from the latest (most recent) subscription row
  const latestSub = subscriptions[0] ?? null;
  const isSubActive = latestSub
    ? new Date(latestSub.validity) > new Date() && latestSub.payment_status === 'paid'
    : false;

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  const fmtAmount = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  const menuItems = [
    { id: 'profile', label: 'Basic Details', icon: User },
    { id: 'scripts', label: 'My Scripts', icon: FileText },
    { id: 'channel', label: 'Channel memory', icon: Video },
    { id: 'subscription', label: 'Subscription', icon: Crown },
    { id: 'billing', label: 'Billing', icon: CreditCard },
    { id: 'password', label: 'Update Password', icon: Lock },
  ];

  // ── Password update state ────────────────────────────────────────────────
  const [pwData, setPwData] = useState({ current: '', next: '', confirm: '' });
  const [showPw, setShowPw] = useState({ current: false, next: false, confirm: false });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(false);
    if (pwData.next.length < 6) { setPwError('New password must be at least 6 characters.'); return; }
    if (pwData.next !== pwData.confirm) { setPwError('Passwords do not match.'); return; }
    setPwSaving(true);
    try {
      // Re-authenticate with current password first
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: session.user.email!,
        password: pwData.current,
      });
      if (signInError) throw new Error('Current password is incorrect.');
      // Now update to the new password
      const { error: updateError } = await supabase.auth.updateUser({ password: pwData.next });
      if (updateError) throw updateError;
      setPwSuccess(true);
      setPwData({ current: '', next: '', confirm: '' });
    } catch (err: any) {
      setPwError(err?.message || 'Failed to update password.');
    } finally {
      setPwSaving(false);
    }
  };

  const nav = (
    <div className="space-y-2">
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-2">
        <nav className="space-y-0.5">
          {menuItems.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => { setActiveTab(id); setIsMobileNavOpen(false); }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left text-sm transition-all ${activeTab === id ? 'bg-[#1d1d1f] text-white font-medium' : 'text-[#1d1d1f] hover:bg-[#f5f5f7]'}`}>
              <Icon className="w-4 h-4 flex-shrink-0" />{label}
            </button>
          ))}
        </nav>
      </div>
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-2">
        <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left text-sm text-red-500 hover:bg-red-50 transition-colors">
          <LogOut className="w-4 h-4 flex-shrink-0" />Logout
        </button>
      </div>
    </div>
  );

  const profileFields: { id: string; label: string; type: string; key: keyof ProfileData; readOnly?: boolean }[] = [
    { id: 'name',           label: 'Full Name',       type: 'text',   key: 'name' },
    { id: 'email',          label: 'Email',           type: 'email',  key: 'email',          readOnly: true },
    { id: 'phone',          label: 'Phone',           type: 'text',   key: 'phone' },
    { id: 'youtube',        label: 'YouTube Link',    type: 'url',    key: 'youtubeLink' },
    { id: 'instagram',      label: 'Instagram Link',  type: 'url',    key: 'instagramLink' },
    { id: 'facebook',       label: 'Facebook Link',   type: 'url',    key: 'facebookLink' },
    { id: 'twitter',        label: 'Twitter Link',    type: 'url',    key: 'twitterLink' },
    { id: 'billing',        label: 'Billing Address', type: 'text',   key: 'billingAddress' },
  ];

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <Header />

      <div className="max-w-screen-8xl mx-auto px-4 sm:px-6 lg:px-10 py-10">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1d1d1f] mb-1"
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}>
            My Profile
          </h1>
          <p className="text-sm text-[#6e6e73] font-light">Manage your account settings and content</p>
        </div>

        {/* Mobile nav toggle */}
        <div className="mb-4 flex lg:hidden">
          <button onClick={() => setIsMobileNavOpen(true)} className="flex items-center gap-2 text-sm font-medium text-[#1d1d1f] bg-white border border-gray-200 px-4 py-2 rounded-xl">
            <Menu className="w-4 h-4" /> Menu
          </button>
        </div>

        {/* Mobile drawer */}
        {isMobileNavOpen && (
          <>
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={() => setIsMobileNavOpen(false)} />
            <div className="fixed top-0 left-0 bottom-0 z-50 w-[min(288px,85vw)] bg-[#f5f5f7] shadow-2xl p-4 flex flex-col gap-4 overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-[#1d1d1f]">Menu</h2>
                <button onClick={() => setIsMobileNavOpen(false)} className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {nav}
            </div>
          </>
        )}

        <div className="flex flex-col lg:flex-row gap-5">
          {/* Sidebar */}
          <div className="hidden lg:block w-56 flex-shrink-0">{nav}</div>

          {/* Content */}
          <div className="flex-1 min-w-0">

            {/* Profile */}
            {activeTab === 'profile' && (
              <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-[#1d1d1f]">Profile Information</h2>
                    <p className="text-[11px] text-[#6e6e73] font-light mt-0.5">Update your personal information and social links</p>
                  </div>
                  {!isEditing ? (
                    <button
                      onClick={() => { setIsEditing(true); setEditData(profileData); setSaveError(null); }}
                      disabled={isFetchingProfile}
                      className="flex items-center gap-2 text-xs font-medium text-[#1d1d1f] bg-[#f5f5f7] hover:bg-gray-200 border border-gray-200 px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
                    >
                      <Edit className="w-3.5 h-3.5" />Edit
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-1.5 text-xs font-medium text-white bg-[#1d1d1f] hover:bg-black px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
                      >
                        {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        {isSaving ? 'Saving…' : 'Save'}
                      </button>
                      <button onClick={handleCancel} disabled={isSaving} className="text-xs font-medium text-[#1d1d1f] bg-[#f5f5f7] hover:bg-gray-200 border border-gray-200 px-4 py-2 rounded-xl transition-colors disabled:opacity-50">Cancel</button>
                    </div>
                  )}
                </div>

                {/* Save error */}
                {saveError && (
                  <div className="mx-6 mt-4 flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />{saveError}
                  </div>
                )}

                <div className="px-6 py-5">
                  {isFetchingProfile ? (
                    <div className="flex items-center justify-center py-12 gap-3 text-[#6e6e73]">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-sm font-light">Loading profile…</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {profileFields.map(f => {
                        const isLocked = f.readOnly || (!isEditing);
                        const value = isEditing ? editData[f.key] : profileData[f.key];
                        return (
                          <div key={f.id} className={f.key === 'billingAddress' ? 'sm:col-span-2' : ''}>
                            <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5 flex items-center gap-1.5">
                              {f.label}
                              {f.readOnly && (
                                <span className="text-[9px] font-semibold bg-gray-100 text-[#6e6e73] px-1.5 py-0.5 rounded-md tracking-wide">LOCKED</span>
                              )}
                            </label>
                            <input
                              id={f.id}
                              type={f.type}
                              value={value as string}
                              onChange={e => !f.readOnly && setEditData({ ...editData, [f.key]: e.target.value })}
                              disabled={isLocked}
                              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition-all
                                ${f.readOnly
                                  ? 'border-gray-100 bg-gray-50 text-[#6e6e73] cursor-not-allowed'
                                  : isEditing
                                  ? 'border-gray-200 bg-white text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/20 focus:border-[#1d1d1f]'
                                  : 'border-gray-200 bg-[#f5f5f7] text-[#1d1d1f]'
                                }`}
                            />
                          </div>
                        );
                      })}

                      {/* Primary Language */}
                      <div>
                        <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5">Primary Language</label>
                        {isEditing ? (
                          <div className="relative" ref={langRef}>
                            <button
                              type="button"
                              onClick={() => setLangOpen(o => !o)}
                              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/20 focus:border-[#1d1d1f]"
                            >
                              <span className={editData.primaryLanguage ? 'text-[#1d1d1f]' : 'text-[#a1a1a6]'}>
                                {editData.primaryLanguage || 'Select a language'}
                              </span>
                              <svg className={`w-4 h-4 text-[#6e6e73] transition-transform ${langOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </button>
                            {langOpen && (
                              <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                                <div className="p-2 border-b border-gray-100">
                                  <input
                                    type="text"
                                    placeholder="Search language…"
                                    value={langSearch}
                                    onChange={e => setLangSearch(e.target.value)}
                                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-[#1d1d1f]/20"
                                    autoFocus
                                  />
                                </div>
                                <ul className="max-h-48 overflow-y-auto">
                                  {ALL_LANGUAGES.filter(l => l.toLowerCase().includes(langSearch.toLowerCase())).map(lang => (
                                    <li key={lang}>
                                      <button
                                        type="button"
                                        onClick={() => { setEditData({ ...editData, primaryLanguage: lang }); setLangOpen(false); setLangSearch(''); }}
                                        className={`w-full text-left px-4 py-2 text-sm transition-colors ${editData.primaryLanguage === lang ? 'bg-[#1d1d1f] text-white' : 'text-[#1d1d1f] hover:bg-[#f5f5f7]'}`}
                                      >
                                        {lang}
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-[#f5f5f7] text-sm text-[#1d1d1f]">
                            {profileData.primaryLanguage || <span className="text-[#a1a1a6]">Not set</span>}
                          </div>
                        )}
                      </div>

                      {/* Categories */}
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5">
                          Content Categories
                          {isEditing && (
                            <span className="ml-1.5 text-[#6e6e73] font-normal">({(isEditing ? editData : profileData).categories.length}/3 selected)</span>
                          )}
                        </label>
                        {isEditing ? (
                          <div className="flex flex-wrap gap-2">
                            {ALL_CATEGORIES.map(cat => {
                              const selected = editData.categories.includes(cat);
                              const disabled = !selected && editData.categories.length >= 3;
                              return (
                                <button
                                  key={cat}
                                  type="button"
                                  disabled={disabled}
                                  onClick={() => {
                                    const next = selected
                                      ? editData.categories.filter(c => c !== cat)
                                      : [...editData.categories, cat];
                                    setEditData({ ...editData, categories: next });
                                  }}
                                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                                    selected
                                      ? 'bg-[#1d1d1f] text-white border-[#1d1d1f]'
                                      : disabled
                                      ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed'
                                      : 'bg-white text-[#1d1d1f] border-gray-200 hover:border-gray-400'
                                  }`}
                                >
                                  {cat}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {profileData.categories.length > 0
                              ? profileData.categories.map(cat => (
                                  <span key={cat} className="px-3 py-1.5 rounded-full text-xs font-medium bg-[#f5f5f7] border border-gray-200 text-[#1d1d1f]">{cat}</span>
                                ))
                              : <span className="text-sm text-[#a1a1a6]">No categories set</span>
                            }
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Scripts */}
            {activeTab === 'scripts' && (
              <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-[#1d1d1f]">My Scripts</h2>
                    <p className="text-[11px] text-[#6e6e73] font-light mt-0.5">View and manage your generated scripts</p>
                  </div>
                  {!isLoadingScripts && myScripts.length > 0 && (
                    <span className="text-[10px] font-medium text-[#6e6e73] bg-[#f5f5f7] px-2.5 py-1 rounded-full">
                      {myScripts.length} script{myScripts.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <div className="px-6 py-4 space-y-3">
                  {isLoadingScripts ? (
                    <div className="flex items-center gap-2 py-8 justify-center text-[#6e6e73]">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-xs font-light">Loading scripts…</span>
                    </div>
                  ) : myScripts.length === 0 ? (
                    <div className="py-10 text-center space-y-2">
                      <FileText className="w-8 h-8 text-gray-200 mx-auto" />
                      <p className="text-sm text-[#6e6e73]">No scripts generated yet.</p>
                      <p className="text-[11px] text-[#6e6e73] font-light">Generate a script from a topic to see it here.</p>
                    </div>
                  ) : (
                    myScripts.map(script => {
                      const isPublished = script.status === 'published' || script.is_public;
                      const dateStr = script.created_at
                        ? new Date(script.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                        : '—';
                      return (
                        <div key={script.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-[#f5f5f7] rounded-2xl border border-gray-100">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[#1d1d1f] truncate">
                              {script.title || script.topic || 'Untitled Script'}
                            </p>
                            <div className="flex flex-wrap items-center gap-3 mt-1.5">
                              <span className="text-[11px] text-[#6e6e73] font-light">{dateStr}</span>
                              {script.estimated_word_count > 0 && (
                                <span className="text-[11px] text-[#6e6e73] font-light">
                                  {script.estimated_word_count.toLocaleString()} words
                                </span>
                              )}
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                isPublished ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'
                              }`}>
                                {isPublished ? 'Published' : script.status ?? 'Draft'}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => router.push(`/script?scriptId=${script.id}`)}
                            className="flex items-center gap-1.5 text-xs font-medium text-[#1d1d1f] bg-white hover:bg-gray-100 border border-gray-200 px-4 py-2 rounded-xl transition-colors flex-shrink-0"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />View Script
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Subscription */}
            {activeTab === 'subscription' && (
              <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100">
                  <h2 className="text-sm font-semibold text-[#1d1d1f]">My Subscription</h2>
                  <p className="text-[11px] text-[#6e6e73] font-light mt-0.5">Manage your subscription and usage</p>
                </div>
                <div className="px-6 py-5">
                  {isLoadingSub ? (
                    <div className="flex items-center gap-2 py-8 justify-center text-[#6e6e73]">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-xs font-light">Loading subscription…</span>
                    </div>
                  ) : !latestSub ? (
                    freeTier ? (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                          <div className="space-y-4">
                            <div>
                              <p className="text-[10px] uppercase tracking-widest text-[#6e6e73] mb-2">Current Plan</p>
                              <div className="flex items-center gap-2">
                                <Crown className="w-5 h-5 text-gray-400" />
                                <span className="text-lg font-semibold text-[#1d1d1f] capitalize">{freeTier.plan}</span>
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Free</span>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-4">
                            <div>
                              <p className="text-[10px] uppercase tracking-widest text-[#6e6e73] mb-2">Credits Remaining</p>
                              {(() => {
                                const plan = freeTier.plan?.toLowerCase();
                                const totalCredits = plan === 'basic' ? 100 : plan === 'pro' ? 200 : 50;
                                return (
                                  <>
                                    <p className="text-3xl font-bold text-[#1d1d1f] mb-2">
                                      {freeTier.credits_remaining}
                                      <span className="text-xl text-gray-400">/{totalCredits}</span>
                                    </p>
                                    <div className="h-4 rounded-full bg-gray-100  ">
          <div
            className="h-full rounded-full bg-[#1d1d1f] transition-all text-white text-xs text-center"
            style={{
              width: `${Math.min(
                ((freeTier.credits_remaining) / totalCredits) * 100,
                100
              )}%`,
            }}
          >
            {freeTier.credits_remaining}% Remaining
          </div>
        </div>
                                    <p className="text-[10px] text-[#6e6e73] mt-1">script generation credits</p>
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <button onClick={() => router.push('/pricing')} className="text-sm font-medium text-white bg-[#1d1d1f] hover:bg-black px-5 py-2.5 rounded-xl transition-colors">
                            Upgrade Plan
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="py-10 text-center space-y-3">
                        <Crown className="w-8 h-8 text-gray-200 mx-auto" />
                        <p className="text-sm text-[#6e6e73]">No subscription found.</p>
                        <button onClick={() => router.push('/pricing')} className="text-sm font-medium text-white bg-[#1d1d1f] hover:bg-black px-5 py-2.5 rounded-xl transition-colors">
                          View Plans
                        </button>
                      </div>
                    )
                  ) : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                        <div className="space-y-4">
                          <div>
                            <p className="text-[10px] uppercase tracking-widest text-[#6e6e73] mb-2">Current Plan</p>
                            <div className="flex items-center gap-2">
                              <Crown className="w-5 h-5 text-amber-500" />
                              <span className="text-lg font-semibold text-[#1d1d1f] capitalize">{latestSub.plan}</span>
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isSubActive ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}>
                                {isSubActive ? 'Active' : 'Expired'}
                              </span>
                            </div>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-widest text-[#6e6e73] mb-1.5">Valid Until</p>
                            <div className="flex items-center gap-2 text-sm text-[#1d1d1f]">
                              <Calendar className="w-4 h-4 text-[#6e6e73]" />
                              {fmtDate(latestSub.validity)}
                            </div>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-widest text-[#6e6e73] mb-1.5">Purchased On</p>
                            <div className="flex items-center gap-2 text-sm text-[#1d1d1f]">
                              <Calendar className="w-4 h-4 text-[#6e6e73]" />
                              {fmtDate(latestSub.purchased_date)}
                            </div>
                          </div>
                        </div>
                        <div className="space-y-4">
                        <div>
  <p className="text-[10px] uppercase tracking-widest text-[#6e6e73] mb-2">
    Credits Remaining
  </p>

  {(() => {
    const totalCredits =
      latestSub.plan?.toLowerCase() === 'basic'
        ? 100
        : latestSub.plan?.toLowerCase() === 'pro'
        ? 200
        : 50;

    return (
      <>
        <p className="text-3xl font-bold text-[#1d1d1f] mb-2">
          {latestSub.credits}
          <span className="text-xl text-gray-400">
            /{totalCredits}
          </span>
        </p>

        <div className="h-4 rounded-full bg-gray-100  ">
          <div
            className="h-full rounded-full bg-[#1d1d1f] transition-all text-white text-xs text-center"
            style={{
              width: `${Math.min(
                ((latestSub.credits) / totalCredits) * 100,
                100
              )}%`,
            }}
          >
            {latestSub.credits}% Remaining
          </div>
        </div>

        <p className="text-[10px] text-[#6e6e73] mt-1">
          script generation credits
        </p>
      </>
    );
  })()}
</div>
                          <div>
                            <p className="text-[10px] uppercase tracking-widest text-[#6e6e73] mb-1.5">Amount Paid</p>
                            <p className="text-sm font-semibold text-[#1d1d1f]">{fmtAmount(latestSub.amount)}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <button onClick={() => router.push('/pricing')} className="text-sm font-medium text-white bg-[#1d1d1f] hover:bg-black px-5 py-2.5 rounded-xl transition-colors">
                          Upgrade Plan
                        </button>
                        <button className="text-sm font-medium text-red-500 bg-red-50 hover:bg-red-100 px-5 py-2.5 rounded-xl transition-colors">
                          Cancel Subscription
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Channel */}
            {activeTab === 'channel' && (
              <div className="space-y-4">
                <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
                  <div className="px-6 py-5 border-b border-gray-100">
                    <h2 className="text-sm font-semibold text-[#1d1d1f]">Channel memory</h2>
                    <p className="text-[11px] text-[#6e6e73] font-light mt-0.5">Upload your channel style guide so AI writes scripts that sound like you</p>
                  </div>

                  <div className="px-6 py-5">
                    {/* Loading state */}
                    {isLoadingChannel && (
                      <div className="flex items-center justify-center py-10 gap-2 text-[#6e6e73]">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-xs font-light">Loading channel profile…</span>
                      </div>
                    )}

                    {/* Existing summary — show when loaded, not re-uploading, and upload not in progress */}
                    {!isLoadingChannel && channelSummary && !isReUploading && uploadStatus !== 'success' && (
                      <div className="space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-green-100 border border-green-200 flex items-center justify-center flex-shrink-0">
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-[#1d1d1f]">Channel profile active</p>
                              <p className="text-[11px] text-[#6e6e73] font-light">AI uses this to match your tone when writing scripts</p>
                            </div>
                          </div>
                          <button
                            onClick={() => { setIsReUploading(true); setChannelFile(null); setUploadStatus('idle'); setUploadError(null); setChannelFileError(null); }}
                            className="flex-shrink-0 text-[11px] font-medium text-[#1d1d1f] border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-[#f5f5f7] transition-colors flex items-center gap-1.5"
                          >
                            <Upload className="w-3 h-3" />
                            Re-upload PDF
                          </button>
                        </div>

                        {/* Summary content */}
                        <div className="bg-[#f5f5f7] rounded-2xl p-4">
                          <p className="text-[10px] font-semibold text-[#6e6e73] uppercase tracking-widest mb-2">Extracted channel summary</p>
                          <p className="text-xs text-[#1d1d1f] leading-relaxed whitespace-pre-wrap">{channelSummary}</p>
                        </div>
                      </div>
                    )}

                    {/* Upload form — show when no summary, re-uploading, or after fresh success */}
                    {!isLoadingChannel && (!channelSummary || isReUploading) && uploadStatus !== 'success' && (
                      <>
                        {/* What to include info box */}
                        <div className="bg-[#f5f5f7] rounded-2xl p-4 mb-5 flex gap-3">
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

                        {/* Hidden file input */}
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="application/pdf"
                          className="hidden"
                          onChange={handleFileChange}
                        />

                        {/* Drop zone */}
                        <div
                          onClick={() => fileInputRef.current?.click()}
                          onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
                          onDragLeave={() => setIsDragOver(false)}
                          onDrop={handleDrop}
                          className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 ${
                            isDragOver
                              ? 'border-[#1d1d1f] bg-gray-50'
                              : channelFile
                              ? 'border-green-300 bg-green-50/40'
                              : channelFileError
                              ? 'border-red-300 bg-red-50/30'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-[#f5f5f7]/60'
                          }`}
                        >
                          {channelFile ? (
                            <div className="flex flex-col items-center gap-3">
                              <div className="w-12 h-12 rounded-2xl bg-green-100 border border-green-200 flex items-center justify-center">
                                <FileIcon className="w-6 h-6 text-green-600" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-[#1d1d1f]">{channelFile.name}</p>
                                <p className="text-[11px] text-[#6e6e73] mt-0.5">{(channelFile.size / 1024 / 1024).toFixed(2)} MB · PDF</p>
                              </div>
                              <button
                                onClick={e => { e.stopPropagation(); setChannelFile(null); setUploadStatus('idle'); setUploadError(null); }}
                                className="text-[11px] text-[#6e6e73] hover:text-red-500 underline transition-colors"
                              >
                                Remove file
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-3">
                              <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center transition-colors ${isDragOver ? 'bg-[#1d1d1f] border-[#1d1d1f]' : 'bg-white border-gray-200'}`}>
                                <Upload className={`w-5 h-5 transition-colors ${isDragOver ? 'text-white' : 'text-[#6e6e73]'}`} />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-[#1d1d1f]">
                                  {isDragOver ? 'Drop it here' : 'Drop your PDF here'}
                                </p>
                                <p className="text-[11px] text-[#6e6e73] mt-0.5">or <span className="underline">click to browse</span> · PDF only · max 10 MB</p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Cancel re-upload */}
                        {isReUploading && (
                          <button
                            onClick={() => { setIsReUploading(false); setChannelFile(null); setUploadStatus('idle'); setUploadError(null); setChannelFileError(null); }}
                            className="mt-2 w-full text-[11px] text-[#6e6e73] hover:text-[#1d1d1f] transition-colors"
                          >
                            Cancel
                          </button>
                        )}

                        {/* Validation error */}
                        {channelFileError && (
                          <div className="mt-3 flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            {channelFileError}
                          </div>
                        )}

                        {/* Upload error */}
                        {uploadStatus === 'error' && uploadError && (
                          <div className="mt-3 flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            {uploadError}
                          </div>
                        )}

                        {/* Upload button */}
                        {channelFile && (
                          <div className="mt-4">
                            <button
                              onClick={handleUpload}
                              disabled={uploadStatus === 'uploading'}
                              className="w-full flex items-center justify-center gap-2 text-sm font-medium text-white bg-[#1d1d1f] hover:bg-black disabled:opacity-60 px-5 py-3 rounded-xl transition-all"
                            >
                              {uploadStatus === 'uploading' ? (
                                <><Loader2 className="w-4 h-4 animate-spin" />Uploading…</>
                              ) : (
                                <><Upload className="w-4 h-4" />Upload Profile PDF</>
                              )}
                            </button>
                          </div>
                        )}
                      </>
                    )}

                    {/* Post-upload success */}
                    {uploadStatus === 'success' && (
                      <div className="flex flex-col items-center gap-3 py-6">
                        <div className="w-14 h-14 rounded-full bg-green-100 border border-green-200 flex items-center justify-center">
                          <CheckCircle2 className="w-7 h-7 text-green-600" />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-semibold text-[#1d1d1f]">Profile uploaded successfully</p>
                          <p className="text-[11px] text-[#6e6e73] mt-0.5">Your channel style guide is now active. Future scripts will reflect your tone.</p>
                        </div>
                        {channelSummary && (
                          <div className="w-full bg-[#f5f5f7] rounded-2xl p-4 mt-2">
                            <p className="text-[10px] font-semibold text-[#6e6e73] uppercase tracking-widest mb-2">Extracted channel summary</p>
                            <p className="text-xs text-[#1d1d1f] leading-relaxed whitespace-pre-wrap">{channelSummary}</p>
                          </div>
                        )}
                        <button
                          onClick={() => { setChannelFile(null); setUploadStatus('idle'); setUploadError(null); setIsReUploading(true); }}
                          className="text-[11px] text-[#6e6e73] hover:text-[#1d1d1f] underline transition-colors"
                        >
                          Upload a different file
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Billing */}
            {activeTab === 'billing' && (
              <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100">
                  <h2 className="text-sm font-semibold text-[#1d1d1f]">Billing History</h2>
                  <p className="text-[11px] text-[#6e6e73] font-light mt-0.5">All your past payments and invoices</p>
                </div>
                <div className="px-6 py-4 space-y-3">
                  {isLoadingSub ? (
                    <div className="flex items-center gap-2 py-8 justify-center text-[#6e6e73]">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-xs font-light">Loading billing history…</span>
                    </div>
                  ) : subscriptions.length === 0 ? (
                    <div className="py-10 text-center">
                      <p className="text-sm text-[#6e6e73]">No billing records found.</p>
                    </div>
                  ) : (
                    subscriptions.map(bill => {
                      const isPaid = bill.payment_status === 'paid';
                      return (
                        <div key={bill.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-[#f5f5f7] rounded-2xl border border-gray-100">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center flex-shrink-0">
                              <DollarSign className="w-4 h-4 text-[#1d1d1f]" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-[#1d1d1f] capitalize">{bill.plan} Plan</p>
                              <p className="text-[11px] text-[#6e6e73] font-light">{fmtDate(bill.purchased_date)}</p>
                              {bill.razorpay_order_id && (
                                <p className="text-[10px] text-[#6e6e73] font-mono mt-0.5">Order: {bill.razorpay_order_id}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                            <span className="text-sm font-semibold text-[#1d1d1f]">{fmtAmount(bill.amount)}</span>
                            <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${isPaid ? 'bg-green-100 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                              {isPaid ? 'Paid' : bill.payment_status}
                            </span>
                            {bill.invoice_url ? (
                              <button
                                onClick={() => downloadInvoice(bill.invoice_url)}
                                className="flex items-center gap-1.5 text-xs font-medium text-[#1d1d1f] bg-white hover:bg-gray-100 border border-gray-200 px-3 py-2 rounded-lg transition-colors min-h-[36px]"
                              >
                                <Download className="w-3.5 h-3.5" />Invoice
                              </button>
                            ) : (
                              <span className="text-[11px] text-[#a1a1a6] font-light">No invoice</span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
            {/* Password */}
            {activeTab === 'password' && (
              <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100">
                  <h2 className="text-sm font-semibold text-[#1d1d1f]">Update Password</h2>
                  <p className="text-[11px] text-[#6e6e73] font-light mt-0.5">Change your account password</p>
                </div>

                <div className="px-6 py-6 max-w-md">
                  {pwSuccess && (
                    <div className="flex items-center gap-2.5 text-xs text-green-700 bg-green-50 border border-green-100 rounded-xl px-4 py-3 mb-5">
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                      Password updated successfully.
                    </div>
                  )}
                  {pwError && (
                    <div className="flex items-center gap-2.5 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-5">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {pwError}
                    </div>
                  )}

                  <form onSubmit={handlePasswordUpdate} className="space-y-4">
                    {(
                      [
                        { key: 'current' as const, label: 'Current password',  show: showPw.current,  toggle: () => setShowPw(p => ({ ...p, current: !p.current })) },
                        { key: 'next'    as const, label: 'New password',       show: showPw.next,     toggle: () => setShowPw(p => ({ ...p, next:    !p.next    })) },
                        { key: 'confirm' as const, label: 'Confirm new password', show: showPw.confirm, toggle: () => setShowPw(p => ({ ...p, confirm: !p.confirm })) },
                      ] as const
                    ).map(({ key, label, show, toggle }) => (
                      <div key={key}>
                        <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5">{label}</label>
                        <div className="relative">
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6e6e73] w-4 h-4" />
                          <input
                            type={show ? 'text' : 'password'}
                            placeholder="••••••••"
                            value={pwData[key]}
                            onChange={e => setPwData(p => ({ ...p, [key]: e.target.value }))}
                            required
                            disabled={pwSaving}
                            className="w-full pl-10 pr-11 py-2.5 rounded-xl border border-gray-200 bg-[#f5f5f7] text-[#1d1d1f] text-sm placeholder-[#a1a1a6] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/20 focus:border-[#1d1d1f] transition-all disabled:opacity-60"
                          />
                          <button
                            type="button"
                            onClick={toggle}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#6e6e73] hover:text-[#1d1d1f] transition-colors"
                          >
                            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    ))}

                    <button
                      type="submit"
                      disabled={pwSaving}
                      className="flex items-center gap-2 text-sm font-medium text-white bg-[#1d1d1f] hover:bg-black px-6 py-2.5 rounded-xl transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 mt-1"
                    >
                      {pwSaving ? <><Loader2 className="w-4 h-4 animate-spin" />Updating…</> : 'Change password'}
                    </button>
                  </form>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
