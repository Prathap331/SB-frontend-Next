'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { Mail, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import Header from '@/components/Header';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (resetError) throw resetError;
      setSent(true);
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

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
                Reset your password
              </h1>
              <p className="text-sm text-[#6e6e73] font-light">
                Enter your email and we&apos;ll send a reset link
              </p>
            </div>

            <div className="px-8 py-6 space-y-4">
              {sent ? (
                <div className="flex flex-col items-center gap-4 py-4 text-center">
                  <div className="w-14 h-14 rounded-full bg-green-100 border border-green-200 flex items-center justify-center">
                    <CheckCircle2 className="w-7 h-7 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#1d1d1f] mb-1">Check your inbox</p>
                    <p className="text-xs text-[#6e6e73] font-light max-w-xs mx-auto">
                      We sent a reset link to <span className="font-medium text-[#1d1d1f]">{email}</span>. Click the link in the email to set a new password.
                    </p>
                  </div>
                  <button
                    onClick={() => { setSent(false); setEmail(''); }}
                    className="text-xs text-[#6e6e73] hover:text-[#1d1d1f] transition-colors underline"
                  >
                    Send to a different email
                  </button>
                </div>
              ) : (
                <>
                  {error && (
                    <div className="text-xs px-4 py-2.5 rounded-xl bg-red-50 text-red-600 border border-red-100 text-center">
                      {error}
                    </div>
                  )}
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5">Email address</label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6e6e73] w-4 h-4" />
                        <input
                          type="email"
                          placeholder="you@example.com"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          required
                          disabled={isLoading}
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-[#f5f5f7] text-[#1d1d1f] text-sm placeholder-[#a1a1a6] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/20 focus:border-[#1d1d1f] transition-all disabled:opacity-60"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#1d1d1f] hover:bg-black text-white text-sm font-medium transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                    >
                      {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Sending…</> : 'Send reset link'}
                    </button>
                  </form>
                </>
              )}

              <div className="text-center pt-1">
                <Link
                  href="/auth"
                  className="inline-flex items-center gap-1.5 text-xs text-[#6e6e73] hover:text-[#1d1d1f] transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
                </Link>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
