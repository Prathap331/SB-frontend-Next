'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Loader2, CheckCircle2, Calendar, RefreshCw,
  MapPin, AlertCircle, ChevronRight, FileText, Zap, Crown, Target,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { pricingPlans } from '@/components/pricingPlans';
import { processPayment } from '@/services/payment';
import { toast } from 'sonner';
import Header from '@/components/Header';

// ── helpers ───────────────────────────────────────────────────────────────────

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

const PLAN_META: Record<string, { minutes: string; validity: string; icon: React.ComponentType<{ className?: string }> }> = {
  free:  { minutes: '100 minutes',      validity: 'One-time use', icon: Target },
  basic: { minutes: '500 minutes',      validity: '30 days',      icon: Zap    },
  pro:   { minutes: 'Unlimited scripts', validity: '30 days',     icon: Crown  },
};

// ── inner component (uses useSearchParams — must be inside Suspense) ─────────

function CheckoutInner() {
  const router = useRouter();
  const params = useSearchParams();
  const tier = params.get('tier') ?? '';

  const plan = pricingPlans.find(p => p.targetTier === tier);
  const meta = PLAN_META[tier];

  const [address, setAddress] = useState('');
  const [loadingAddress, setLoadingAddress] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentDone, setPaymentDone] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  // Redirect if plan not found
  useEffect(() => {
    if (!plan || !meta) router.replace('/pricing');
  }, [plan, meta, router]);

  // Fetch billing address from profile
  useEffect(() => {
    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const { data } = await supabase
          .from('profiles')
          .select('billing_address')
          .eq('id', session.user.id)
          .single();
        setAddress(data?.billing_address ?? '');
      } finally {
        setLoadingAddress(false);
      }
    };
    load();
  }, []);

  if (!plan || !meta) return null;

  const nextBillingDate = addDays(30);
  const IconComponent = meta.icon;

  const handlePay = async () => {
    setIsProcessing(true);
    setPaymentError('');
    try {
      await processPayment(
        plan.amount,
        plan.targetTier,
        (_paymentId, _orderId) => {
          setIsProcessing(false);
          setPaymentDone(true);
          toast.success('Payment successful!', {
            description: 'Your subscription is being activated.',
            duration: 5000,
          });
          setTimeout(() => router.push('/profile'), 2500);
        },
        (error) => {
          setIsProcessing(false);
          if (error !== 'Payment cancelled by user') {
            setPaymentError(error);
            toast.error('Payment failed', { description: error, duration: 5000 });
          }
        },
      );
    } catch (err: any) {
      setIsProcessing(false);
      const msg = err?.message ?? 'Payment processing failed';
      setPaymentError(msg);
      toast.error('Payment error', { description: msg, duration: 5000 });
    }
  };

  // ── success screen ─────────────────────────────────────────────────────────
  if (paymentDone) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl shadow-xl shadow-black/[0.08] border border-gray-200/80 p-10 flex flex-col items-center gap-4 max-w-sm w-full text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 border border-green-200 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <div>
            <p className="text-lg font-semibold text-[#1d1d1f]">Payment successful!</p>
            <p className="text-sm text-[#6e6e73] font-light mt-1">Taking you to your profile…</p>
          </div>
          <Loader2 className="w-5 h-5 animate-spin text-[#6e6e73]" />
        </div>
      </div>
    );
  }

  // ── main checkout ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <Header />

      <div className="max-w-xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-4">

        {/* ── Title ── */}
        <div className="text-center mb-6">
          <h1
            className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1d1d1f]"
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}
          >
            Checkout
          </h1>
          <p className="text-sm text-[#6e6e73] font-light mt-1">Review your order before completing purchase</p>
        </div>

        {/* ── Plan card ── */}
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100">
            <p className="text-[10px] uppercase tracking-widest font-semibold text-[#6e6e73]">Plan</p>
          </div>
          <div className="px-6 py-5">
            {/* Logo + name row */}
            <div className="flex items-center gap-4 mb-5">
              <div className="w-12 h-12 rounded-2xl bg-[#1d1d1f] flex items-center justify-center flex-shrink-0">
                <IconComponent className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold text-[#1d1d1f]">StoryBit {plan.name}</p>
                <p className="text-sm text-[#6e6e73] font-light">{plan.description}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xl font-bold text-[#1d1d1f]">{plan.price}</p>
                <p className="text-xs text-[#6e6e73]">{plan.period}</p>
              </div>
            </div>

            {/* Details grid */}
            <div className="space-y-0 divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
              {[
                { label: 'Script generation', value: meta.minutes },
                { label: 'Validity',           value: meta.validity },
                { label: 'Next billing date',  value: nextBillingDate,
                  icon: <Calendar className="w-3.5 h-3.5 text-[#6e6e73]" /> },
                { label: 'Auto billing',       value: 'Renews automatically each month',
                  icon: <RefreshCw className="w-3.5 h-3.5 text-[#6e6e73]" /> },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between px-4 py-3 bg-[#f5f5f7]">
                  <div className="flex items-center gap-2">
                    {row.icon ?? null}
                    <span className="text-xs text-[#6e6e73] font-medium">{row.label}</span>
                  </div>
                  <span className="text-xs font-semibold text-[#1d1d1f] text-right max-w-[55%]">{row.value}</span>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-[#6e6e73] mt-3 leading-relaxed">
              Cancel anytime online.{' '}
              <Link href="/cancellation-policy" className="text-[#1d1d1f] underline underline-offset-2 hover:opacity-70 transition-opacity">
                Cancellation policy
              </Link>
            </p>
          </div>
        </div>

        {/* ── Address card ── */}
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-widest font-semibold text-[#6e6e73]">Address</p>
            <Link
              href="/profile?tab=profile"
              className="text-xs font-medium text-[#1d1d1f] hover:underline"
            >
              Edit
            </Link>
          </div>
          <div className="px-6 py-4">
            {loadingAddress ? (
              <div className="flex items-center gap-2 text-[#6e6e73]">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm font-light">Loading…</span>
              </div>
            ) : address ? (
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-[#6e6e73] flex-shrink-0 mt-0.5" />
                <p className="text-sm text-[#1d1d1f]">{address}</p>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-sm text-[#6e6e73] font-light">No billing address on file</p>
                <Link
                  href="/profile?tab=profile"
                  className="text-xs font-medium text-[#1d1d1f] flex items-center gap-1 hover:underline"
                >
                  Add <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* ── Payment method card ── */}
        {/* <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100">
            <p className="text-[10px] uppercase tracking-widest font-semibold text-[#6e6e73]">Payment method</p>
          </div>
          <div className="px-6 py-4">
            <div className="flex items-center gap-3 p-3.5 border border-[#1d1d1f] rounded-xl bg-[#f5f5f7]"> */}
              {/* Razorpay logo as SVG wordmark */}
              {/* <div className="flex items-center gap-2 flex-1">
                <div className="w-8 h-8 rounded-lg bg-[#072654] flex items-center justify-center flex-shrink-0">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
                    <path d="M22.368 8.175L19.07 2.5 9.847 8.175l3.298 5.677 9.223-5.677zM1.632 15.825L4.93 21.5l9.223-5.675-3.298-5.677-9.223 5.677z"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#1d1d1f]">Razorpay</p>
                  <p className="text-[11px] text-[#6e6e73]">UPI · Cards · Netbanking · Wallets</p>
                </div>
              </div>
              <div className="w-4 h-4 rounded-full border-[1.5px] border-[#1d1d1f] flex items-center justify-center flex-shrink-0">
                <div className="w-2 h-2 rounded-full bg-[#1d1d1f]" />
              </div>
            </div>
          </div>
        </div> */}

        {/* ── Summary card ── */}
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100">
            <p className="text-[10px] uppercase tracking-widest font-semibold text-[#6e6e73]">Summary</p>
          </div>
          <div className="px-6 py-5 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#6e6e73] font-light">StoryBit {plan.name}</span>
              <span className="font-semibold text-[#1d1d1f]">{plan.price}</span>
            </div>
            <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-[#1d1d1f]">Total now</span>
              <span className="text-lg font-bold text-[#1d1d1f]">{plan.price}</span>
            </div>
            <p className="text-[11px] text-[#6e6e73] leading-relaxed">
              By completing this purchase you agree to our{' '}
              <Link href="/cancellation-policy" className="text-[#1d1d1f] underline underline-offset-2">
                cancellation policy
              </Link>
              . Taxes may apply based on your address.
            </p>
          </div>
        </div>

        {/* ── Error ── */}
        {paymentError && (
          <div className="flex items-center gap-2.5 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {paymentError}
          </div>
        )}

        {/* ── CTA ── */}
        <button
          onClick={handlePay}
          disabled={isProcessing}
          className="w-full py-4 rounded-2xl bg-[#1d1d1f] hover:bg-black text-white text-sm font-semibold transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-black/10"
        >
          {isProcessing ? (
            <><Loader2 className="w-4 h-4 animate-spin" />Processing payment…</>
          ) : (
            <>Complete purchase · {plan.price}</>
          )}
        </button>

        <div className="flex items-center justify-center gap-1.5 text-[11px] text-[#6e6e73]">
          <FileText className="w-3.5 h-3.5" />
          Secured by Razorpay · 256-bit encryption
        </div>

      </div>
    </div>
  );
}

// ── page wrapper (Suspense boundary required for useSearchParams) ─────────────

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-[#1d1d1f]" />
      </div>
    }>
      <CheckoutInner />
    </Suspense>
  );
}
