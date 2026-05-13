'use client';

import { useState, ChangeEvent, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, Lock, User, Eye, EyeOff, Phone, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

const inputClass =
  'w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-[#f5f5f7] text-[#1d1d1f] text-sm placeholder-[#a1a1a6] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/20 focus:border-[#1d1d1f] transition-all disabled:opacity-60';

export default function AuthForm() {
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', password: '', confirmPassword: '',
  });

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  // ── Sign-up: Step 1 → create account + send confirmation email ────────────
  const handleSignUp = async (e: FormEvent) => {
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

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: { full_name: formData.name },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;

      // Save basic profile immediately (name + phone — rest filled after email confirmation)
      if (data.user) {
        await supabase.from('user_profiles').upsert({
          id:        data.user.id,
          email:     formData.email,
          full_name: formData.name,
          phone:     formData.phone || null,
        }, { onConflict: 'id' });
      }

      setEmailSent(true);
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Something went wrong.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // ── Sign-in ──────────────────────────────────────────────────────────────
  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage({ text: '', type: '' });
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });
      if (error) throw error;
      router.push('/');
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Something went wrong.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // ── Google sign-in ───────────────────────────────────────────────────────
  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      });
      if (error) throw error;
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Google Sign-in failed.', type: 'error' });
      setIsLoading(false);
    }
  };

  const switchMode = () => {
    setIsSignUp(v => !v);
    setEmailSent(false);
    setMessage({ text: '', type: '' });
  };

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-3xl shadow-xl shadow-black/[0.08] border border-gray-200/80 overflow-hidden">

        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b border-gray-100 text-center">
          <h1
            className="text-2xl font-semibold text-[#1d1d1f] mb-1 tracking-tight"
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}
          >
            {!isSignUp ? 'Welcome back' : emailSent ? 'Check your inbox' : 'Create your account'}
          </h1>
          <p className="text-sm text-[#6e6e73] font-light">
            {!isSignUp
              ? 'Sign in to continue to Storybit'
              : emailSent
              ? `We sent a confirmation link to ${formData.email}`
              : 'Start creating research-backed YouTube scripts'}
          </p>
        </div>

        <div className="px-8 py-6 space-y-5">

          {/* Email-sent confirmation screen */}
          {isSignUp && emailSent && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 border border-green-200 flex items-center justify-center">
                <Mail className="w-7 h-7 text-green-600" />
              </div>
              <div className="space-y-1">
                <p className="text-sm text-[#1d1d1f] font-medium">Confirmation email sent!</p>
                <p className="text-xs text-[#6e6e73] font-light leading-relaxed">
                  Click the link in the email to verify your account and complete your profile setup.
                </p>
              </div>
              <p className="text-[11px] text-[#6e6e73]">
                Didn&apos;t receive it?{' '}
                <button
                  type="button"
                  onClick={() => setEmailSent(false)}
                  className="text-[#1d1d1f] underline"
                >
                  Try again
                </button>
              </p>
            </div>
          )}

          {/* Google sign-in (sign-in and sign-up step 1 only) */}
          {(!isSignUp || !emailSent) && (
            <>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-[#1d1d1f] text-sm font-medium transition-all duration-200 disabled:opacity-50"
              >
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

          {/* Error / info message */}
          {message.text && (
            <div className={`text-xs text-center px-4 py-2.5 rounded-xl ${
              message.type === 'error'
                ? 'bg-red-50 text-red-600 border border-red-100'
                : 'bg-green-50 text-green-700 border border-green-100'
            }`}>
              {message.text}
            </div>
          )}

          {/* Sign-in form */}
          {!isSignUp && (
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
                    {showPassword ? <span className="text-xs">Hide</span> : <span className="text-xs">Show</span>}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={isLoading} className="w-full py-2.5 rounded-xl bg-[#1d1d1f] hover:bg-black text-white text-sm font-medium transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 mt-1 flex items-center justify-center gap-2">
                {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Signing in…</> : 'Sign In'}
              </button>
            </form>
          )}

          {/* Sign-up form (step 1 only) */}
          {isSignUp && !emailSent && (
            <form onSubmit={handleSignUp} className="space-y-4">
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
                  <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#6e6e73] text-xs">
                    {showPassword ? 'Hide' : 'Show'}
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
              <button type="submit" disabled={isLoading} className="w-full py-2.5 rounded-xl bg-[#1d1d1f] hover:bg-black text-white text-sm font-medium transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 mt-1 flex items-center justify-center gap-2">
                {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Creating account…</> : 'Create Account →'}
              </button>
            </form>
          )}

          {/* Switch mode + forgot password */}
          {!emailSent && (
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
          )}
        </div>
      </div>
    </div>
  );
}
