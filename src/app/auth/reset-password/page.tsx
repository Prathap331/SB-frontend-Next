'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Eye, EyeOff, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import Header from '@/components/Header';

type Status = 'loading' | 'ready' | 'success' | 'invalid';

export default function ResetPassword() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('loading');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Supabase parses the recovery token from the URL hash via detectSessionInUrl.
    // We listen for the PASSWORD_RECOVERY event to confirm the token is valid.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setStatus('ready');
      }
    });

    // Also check if a session already exists (handles page refresh after token parse)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setStatus('ready');
      else {
        // Give the onAuthStateChange a moment to fire before declaring invalid
        setTimeout(() => {
          setStatus(prev => prev === 'loading' ? 'invalid' : prev);
        }, 2000);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setStatus('success');
      // Redirect to sign-in after a short delay so the user sees the success state
      setTimeout(() => router.replace('/auth'), 2500);
    } catch (err: any) {
      setError(err?.message || 'Failed to update password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass =
    'w-full pl-10 pr-11 py-2.5 rounded-xl border border-gray-200 bg-[#f5f5f7] text-[#1d1d1f] text-sm placeholder-[#a1a1a6] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/20 focus:border-[#1d1d1f] transition-all disabled:opacity-60';

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <Header />
      <div className="flex items-center justify-center px-4 sm:px-6 py-10 sm:py-16">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-xl shadow-black/[0.08] border border-gray-200/80 overflow-hidden">

            <div className="px-8 pt-8 pb-6 border-b border-gray-100 text-center">
              <h1
                className="text-2xl font-semibold text-[#1d1d1f] mb-1 tracking-tight"
                style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}
              >
                Set new password
              </h1>
              <p className="text-sm text-[#6e6e73] font-light">Choose a strong password for your account</p>
            </div>

            <div className="px-8 py-6">

              {/* Loading — verifying token */}
              {status === 'loading' && (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <Loader2 className="w-7 h-7 animate-spin text-[#1d1d1f]" />
                  <p className="text-sm text-[#6e6e73] font-light">Verifying reset link…</p>
                </div>
              )}

              {/* Invalid / expired link */}
              {status === 'invalid' && (
                <div className="flex flex-col items-center gap-4 py-8 text-center">
                  <div className="w-14 h-14 rounded-full bg-red-100 border border-red-200 flex items-center justify-center">
                    <AlertCircle className="w-7 h-7 text-red-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#1d1d1f] mb-1">Link expired or invalid</p>
                    <p className="text-xs text-[#6e6e73] font-light max-w-xs mx-auto">
                      This reset link has expired or already been used. Request a new one.
                    </p>
                  </div>
                  <button
                    onClick={() => router.replace('/forgot-password')}
                    className="text-sm font-medium text-white bg-[#1d1d1f] hover:bg-black px-6 py-2.5 rounded-xl transition-all"
                  >
                    Request new link
                  </button>
                </div>
              )}

              {/* Success */}
              {status === 'success' && (
                <div className="flex flex-col items-center gap-4 py-8 text-center">
                  <div className="w-14 h-14 rounded-full bg-green-100 border border-green-200 flex items-center justify-center">
                    <CheckCircle2 className="w-7 h-7 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#1d1d1f] mb-1">Password updated</p>
                    <p className="text-xs text-[#6e6e73] font-light">Redirecting you to sign in…</p>
                  </div>
                  <Loader2 className="w-4 h-4 animate-spin text-[#6e6e73]" />
                </div>
              )}

              {/* Form */}
              {status === 'ready' && (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {error && (
                    <div className="text-xs px-4 py-2.5 rounded-xl bg-red-50 text-red-600 border border-red-100 text-center">
                      {error}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5">New password</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6e6e73] w-4 h-4" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Min 6 characters"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        disabled={isLoading}
                        className={inputClass}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(v => !v)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#6e6e73] hover:text-[#1d1d1f] transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5">Confirm new password</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6e6e73] w-4 h-4" />
                      <input
                        type={showConfirm ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={confirm}
                        onChange={e => setConfirm(e.target.value)}
                        required
                        disabled={isLoading}
                        className={inputClass}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(v => !v)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#6e6e73] hover:text-[#1d1d1f] transition-colors"
                      >
                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#1d1d1f] hover:bg-black text-white text-sm font-medium transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 mt-1"
                  >
                    {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Updating…</> : 'Change password'}
                  </button>
                </form>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
