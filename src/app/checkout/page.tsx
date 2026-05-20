'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Loader2, CheckCircle2, Calendar, RefreshCw,
  MapPin, AlertCircle, ChevronRight, FileText, Zap, Crown, Target, Phone, X,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { processPayment } from '@/services/payment';
import { toast } from 'sonner';
import Header from '@/components/Header';

// ── helpers ───────────────────────────────────────────────────────────────────

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

const PLAN_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  free: Target,
  plus: Zap,
  pro:  Crown,
};

const PLAN_VALIDITY: Record<string, string> = {
  free: 'One-time use',
  plus: '30 days',
  pro:  '30 days',
};

const PLAN_DESCRIPTIONS: Record<string, string> = {
  free: 'Perfect for trying out our AI scriptwriting',
  plus: 'Great for regular content creators',
  pro:  'For professional content creators and teams',
};

// ── inner component (uses useSearchParams — must be inside Suspense) ─────────

type DBPlanRow = {
  plan_name: string;
  plan_amount: number;
  mins: number;
};

function CheckoutInner() {
  const router = useRouter();
  const params = useSearchParams();
  const tier = params.get('tier') ?? '';

  const [dbPlan, setDbPlan] = useState<DBPlanRow | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentDone, setPaymentDone] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  // Missing-fields modal
  const [showMissingModal, setShowMissingModal] = useState(false);
  const [modalPhone, setModalPhone] = useState('');
  const [modalAddress, setModalAddress] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Fetch plan from Supabase
  useEffect(() => {
    if (!tier) { setLoadingPlan(false); return; }
    const fetchPlan = async () => {
      const { data } = await supabase
        .from('subscriptions_plan')
        .select('plan_name, plan_amount, mins')
        .ilike('plan_name', tier)
        .maybeSingle();
      setDbPlan(data ?? null);
      setLoadingPlan(false);
    };
    fetchPlan();
  }, [tier]);

  // Redirect if plan not found after loading
  useEffect(() => {
    if (!loadingPlan && !dbPlan) router.replace('/pricing');
  }, [dbPlan, loadingPlan, router]);

  // Fetch phone + billing address from profile
  useEffect(() => {
    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const { data } = await supabase
          .from('user_profiles')
          .select('billing_address, phone')
          .eq('id', session.user.id)
          .single();
        setAddress(data?.billing_address ?? '');
        setPhone(data?.phone ?? '');
      } finally {
        setLoadingProfile(false);
      }
    };
    load();
  }, []);

  if (loadingPlan || !dbPlan) return null;

  const planKey        = tier.toLowerCase();
  const planName       = dbPlan.plan_name;
  const planAmount     = dbPlan.plan_amount;
  const planPrice      = planAmount === 0 ? '₹0' : `₹${planAmount}`;
  const planPeriod     = planAmount === 0 ? 'One-time' : '/month';
  const planMins       = dbPlan.mins;
  const planDesc       = PLAN_DESCRIPTIONS[planKey] ?? '';
  const planValidity   = PLAN_VALIDITY[planKey] ?? '30 days';
  const IconComponent  = PLAN_ICONS[planKey] ?? Target;
  const nextBillingDate = addDays(30);

  const handlePay = async () => {
    if (!phone.trim() || !address.trim()) {
      setModalPhone(phone);
      setModalAddress(address);
      setShowMissingModal(true);
      return;
    }
    await triggerPayment();
  };

  const triggerPayment = async () => {
    setIsProcessing(true);
    setPaymentError('');
    try {
      await processPayment(
        planAmount,
        planKey,
        async (_paymentId, _orderId) => {
          const { data: { user } } = await supabase.auth.getUser();
          if (user?.email) {
            await fetch('/api/send-payment-email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: user.email, planName, amount: planAmount, mins: planMins }),
            });
          }
          setIsProcessing(false);
          setPaymentDone(true);
          toast.success('Payment successful!', { description: 'Your subscription is being activated.', duration: 5000 });
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

  const handleSaveAndPay = async () => {
    if (!modalPhone.trim() || !modalAddress.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }
    setSavingProfile(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error('Session expired, please log in again'); return; }
      const { error } = await supabase
        .from('user_profiles')
        .update({ phone: modalPhone.trim(), billing_address: modalAddress.trim() })
        .eq('id', session.user.id);
      if (error) { toast.error('Failed to save details'); return; }
      setPhone(modalPhone.trim());
      setAddress(modalAddress.trim());
      setShowMissingModal(false);
      await triggerPayment();
    } finally {
      setSavingProfile(false);
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
                <p className="text-base font-semibold text-[#1d1d1f]">StoryBit {planName}</p>
                <p className="text-sm text-[#6e6e73] font-light">{planDesc}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xl font-bold text-[#1d1d1f]">{planPrice}</p>
                <p className="text-xs text-[#6e6e73]">{planPeriod}</p>
              </div>
            </div>

            {/* Details grid */}
            <div className="space-y-0 divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
              {[
                { label: 'Script generation', value: `${planMins} minutes` },
                { label: 'Validity',           value: planValidity },
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

        {/* ── Phone card ── */}
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-widest font-semibold text-[#6e6e73]">Phone</p>
            <Link href="/profile?tab=profile" className="text-xs font-medium text-[#1d1d1f] hover:underline">Edit</Link>
          </div>
          <div className="px-6 py-4">
            {loadingProfile ? (
              <div className="flex items-center gap-2 text-[#6e6e73]">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm font-light">Loading…</span>
              </div>
            ) : phone ? (
              <div className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-[#6e6e73] flex-shrink-0" />
                <p className="text-sm text-[#1d1d1f]">{phone}</p>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-sm text-[#6e6e73] font-light">No phone number on file</p>
                <Link href="/profile?tab=profile" className="text-xs font-medium text-[#1d1d1f] flex items-center gap-1 hover:underline">
                  Add <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* ── Address card ── */}
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-widest font-semibold text-[#6e6e73]">Address</p>
            <Link href="/profile?tab=profile" className="text-xs font-medium text-[#1d1d1f] hover:underline">Edit</Link>
          </div>
          <div className="px-6 py-4">
            {loadingProfile ? (
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
                <Link href="/profile?tab=profile" className="text-xs font-medium text-[#1d1d1f] flex items-center gap-1 hover:underline">
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
              <span className="text-[#6e6e73] font-light">StoryBit {planName}</span>
              <span className="font-semibold text-[#1d1d1f]">{planPrice}</span>
            </div>
            <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-[#1d1d1f]">Total now</span>
              <span className="text-lg font-bold text-[#1d1d1f]">{planPrice}</span>
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
            <>Complete purchase · {planPrice}</>
          )}
        </button>

        <div className="flex items-center justify-center gap-1.5 text-[11px] text-[#6e6e73]">
          <FileText className="w-3.5 h-3.5" />
          Secured by Razorpay · 256-bit encryption
        </div>

      </div>

      {/* ── Missing fields modal ── */}
      {showMissingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowMissingModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl shadow-black/20 border border-gray-200/80 w-full max-w-sm p-6 flex flex-col gap-5">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <p className="text-base font-semibold text-[#1d1d1f]">Complete your details</p>
                <p className="text-xs text-[#6e6e73] font-light mt-0.5">Required before completing purchase</p>
              </div>
              <button onClick={() => setShowMissingModal(false)} className="text-[#6e6e73] hover:text-[#1d1d1f] transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Missing field inputs */}
            <div className="flex flex-col gap-3">
              {!phone.trim() && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-[#1d1d1f]">Phone number</label>
                  <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2.5 focus-within:border-[#1d1d1f] transition-colors">
                    <Phone className="w-3.5 h-3.5 text-[#6e6e73] flex-shrink-0" />
                    <input
                      type="tel"
                      value={modalPhone}
                      onChange={e => setModalPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="flex-1 text-sm text-[#1d1d1f] bg-transparent outline-none placeholder:text-[#6e6e73] placeholder:font-light"
                    />
                  </div>
                </div>
              )}
              {!address.trim() && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-[#1d1d1f]">Billing address</label>
                  <div className="flex items-start gap-2 border border-gray-200 rounded-xl px-3 py-2.5 focus-within:border-[#1d1d1f] transition-colors">
                    <MapPin className="w-3.5 h-3.5 text-[#6e6e73] flex-shrink-0 mt-0.5" />
                    <textarea
                      value={modalAddress}
                      onChange={e => setModalAddress(e.target.value)}
                      placeholder="Street, City, State, PIN"
                      rows={2}
                      className="flex-1 text-sm text-[#1d1d1f] bg-transparent outline-none placeholder:text-[#6e6e73] placeholder:font-light resize-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <button
              onClick={handleSaveAndPay}
              disabled={savingProfile}
              className="w-full py-3 rounded-xl bg-[#1d1d1f] hover:bg-black text-white text-sm font-semibold transition-all duration-200 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {savingProfile ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : 'Save & continue to payment'}
            </button>
          </div>
        </div>
      )}
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
