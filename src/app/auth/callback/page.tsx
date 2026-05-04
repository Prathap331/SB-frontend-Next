'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Phone, Globe, MapPin, ChevronRight, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import Header from '@/components/Header';

type Status = 'loading' | 'form' | 'redirecting';

type FormData = {
  phone: string;
  youtubeLink: string;
  instagramLink: string;
  facebookLink: string;
  twitterLink: string;
  billingAddress: string;
};

const fields: {
  name: keyof FormData;
  label: string;
  placeholder: string;
  type: string;
  Icon: React.ComponentType<{ className?: string }>;
  span?: boolean;
}[] = [
  { name: 'phone',          label: 'Phone',           placeholder: '+1 (555) 000-0000',              type: 'tel',  Icon: Phone },
  { name: 'youtubeLink',    label: 'YouTube',         placeholder: 'https://youtube.com/@handle',    type: 'url',  Icon: Globe },
  { name: 'instagramLink',  label: 'Instagram',       placeholder: 'https://instagram.com/handle',   type: 'url',  Icon: Globe },
  { name: 'facebookLink',   label: 'Facebook',        placeholder: 'https://facebook.com/handle',    type: 'url',  Icon: Globe },
  { name: 'twitterLink',    label: 'X / Twitter',     placeholder: 'https://twitter.com/handle',     type: 'url',  Icon: Globe },
  { name: 'billingAddress', label: 'Billing Address', placeholder: '123 Main St, New York, NY 10001', type: 'text', Icon: MapPin, span: true },
];

const inputClass =
  'w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-[#f5f5f7] text-[#1d1d1f] text-sm placeholder-[#a1a1a6] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/20 focus:border-[#1d1d1f] transition-all disabled:opacity-60';

export default function AuthCallback() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('loading');
  const [userId, setUserId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState<FormData>({
    phone: '', youtubeLink: '', instagramLink: '',
    facebookLink: '', twitterLink: '', billingAddress: '',
  });

  useEffect(() => {
    const init = async () => {
      // Give Supabase a moment to parse the session from the URL hash/code
      // detectSessionInUrl: true in supabaseClient handles this automatically
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        router.replace('/auth');
        return;
      }

      const user = session.user;
      setUserId(user.id);

      // Pull the best available display name from Google metadata
      const fullName =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split('@')[0] ||
        '';

      // Always upsert email + full_name — safe for both new and returning users
      await supabase.from('profiles').upsert(
        {
          id:         user.id,
          email:      user.email ?? '',
          full_name:  fullName,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

      // Check if this user already has profile details filled in
      const { data: existing } = await supabase
        .from('profiles')
        .select('phone, youtube_link, instagram_link, facebook_link, twitter_link, billing_address')
        .eq('id', user.id)
        .single();

      const hasDetails =
        existing &&
        (existing.phone || existing.youtube_link || existing.instagram_link ||
         existing.facebook_link || existing.twitter_link || existing.billing_address);

      if (hasDetails) {
        // Returning user with existing details — go straight to app
        setStatus('redirecting');
        router.replace('/');
        return;
      }

      // New user — show profile completion form
      setStatus('form');
    };

    init();
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const saveAndContinue = async (data: Partial<FormData>) => {
    setIsSaving(true);
    setError('');
    try {
      const { error: upsertError } = await supabase.from('profiles').upsert(
        {
          id:               userId,
          phone:            data.phone            || null,
          youtube_link:     data.youtubeLink      || null,
          instagram_link:   data.instagramLink    || null,
          facebook_link:    data.facebookLink     || null,
          twitter_link:     data.twitterLink      || null,
          billing_address:  data.billingAddress   || null,
          updated_at:       new Date().toISOString(),
        },
        { onConflict: 'id' }
      );
      if (upsertError) throw upsertError;
      setStatus('redirecting');
      router.replace('/');
    } catch (err: any) {
      setError(err?.message || 'Failed to save. Please try again.');
      setIsSaving(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveAndContinue(formData);
  };

  const handleSkip = () => saveAndContinue({});

  // ── Loading / redirecting spinner ────────────────────────────────────────
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

  // ── Profile completion form ───────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <Header />

      <div className="flex items-center justify-center px-4 sm:px-6 py-10 sm:py-16">
        <div className="w-full max-w-lg">
          <div className="bg-white rounded-3xl shadow-xl shadow-black/[0.08] border border-gray-200/80 overflow-hidden">

            {/* Header */}
            <div className="px-8 pt-8 pb-6 border-b border-gray-100 text-center">
              <div className="w-12 h-12 rounded-2xl bg-green-100 border border-green-200 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
              <h1
                className="text-2xl font-semibold text-[#1d1d1f] mb-1 tracking-tight"
                style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}
              >
                Complete your profile
              </h1>
              <p className="text-sm text-[#6e6e73] font-light">
                Add your details so scripts feel more personal. All fields are optional.
              </p>
            </div>

            <div className="px-8 py-6 space-y-5">
              {/* Error */}
              {error && (
                <div className="text-xs px-4 py-2.5 rounded-xl bg-red-50 text-red-600 border border-red-100 text-center">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {fields.map(({ name, label, placeholder, type, Icon, span }) => (
                    <div key={name} className={span ? 'sm:col-span-2' : ''}>
                      <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5">{label}</label>
                      <div className="relative">
                        <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6e6e73] w-4 h-4" />
                        <input
                          name={name}
                          type={type}
                          placeholder={placeholder}
                          value={formData[name]}
                          onChange={handleChange}
                          disabled={isSaving}
                          className={inputClass}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-1 space-y-2.5">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#1d1d1f] hover:bg-black text-white text-sm font-medium transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                  >
                    {isSaving ? (
                      <><Loader2 className="w-4 h-4 animate-spin" />Saving…</>
                    ) : (
                      <>Save &amp; Continue <ChevronRight className="w-4 h-4" /></>
                    )}
                  </button>

                  {/* <button
                    type="button"
                    onClick={handleSkip}
                    disabled={isSaving}
                    className="w-full py-2 text-xs text-[#6e6e73] hover:text-[#1d1d1f] transition-colors disabled:opacity-50"
                  >
                    Skip for now — I&apos;ll fill this in later
                  </button> */}
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
