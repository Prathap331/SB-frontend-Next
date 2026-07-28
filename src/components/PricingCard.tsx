'use client';

import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import {
  type BillingCycle,
  type PricingCurrency,
  type PricingPlan,
  annualSavings,
  displayPrice,
  formatMoney,
} from './pricingPlans';

interface PricingCardProps {
  plan: PricingPlan;
  billing: BillingCycle;
  currency: PricingCurrency;
  isHighlighted: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export default function PricingCard({
  plan,
  billing,
  currency,
  isHighlighted,
  onMouseEnter,
  onMouseLeave,
}: PricingCardProps) {
  const router = useRouter();
  const IconComponent = plan.icon;
  const price = displayPrice(plan, billing);
  const savings = billing === 'annual' ? annualSavings(plan) : null;
  const money = (n: number) => formatMoney(n, currency);

  const handlePlanSelection = async () => {
    if (!plan.priceAvailable) {
      toast.error('Price unavailable', {
        description: 'USD pricing is not set for this plan yet.',
        duration: 3000,
      });
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error('Authentication Required', {
        description: 'Please login to continue with subscription.',
        duration: 3000,
      });
      router.push('/auth');
      return;
    }
    if (plan.monthlyAmount === 0 || plan.targetTier === 'free') {
      router.push('/');
      return;
    }
    const q = new URLSearchParams({
      tier: plan.targetTier,
      billing,
      currency,
    });
    router.push(`/checkout?${q.toString()}`);
  };

  const badgeClass = isHighlighted
    ? 'bg-white text-[#1d1d1f] border-gray-100'
    : 'bg-[#1d1d1f] text-white border-transparent';

  const ctaClass = isHighlighted
    ? 'bg-white text-[#1d1d1f] hover:bg-gray-100'
    : 'bg-[#1d1d1f] text-white hover:bg-black';

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`relative flex flex-col rounded-3xl p-7 sm:p-8 transition-all duration-300 cursor-default ${
        isHighlighted
          ? 'bg-[#1d1d1f] text-white shadow-2xl shadow-black/20 scale-[1.02]'
          : 'bg-white border border-gray-200 shadow-sm'
      }`}
    >
      {plan.badge && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <span
            className={`text-[10px] font-bold tracking-wide uppercase px-3.5 py-1 rounded-full shadow-sm border ${badgeClass}`}
          >
            {plan.badge}
          </span>
        </div>
      )}

      <div
        className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-4 transition-colors duration-300 ${
          isHighlighted ? 'bg-white/10' : 'bg-[#f5f5f7]'
        }`}
      >
        <IconComponent
          className={`w-5 h-5 ${isHighlighted ? 'text-white' : 'text-[#1d1d1f]'}`}
        />
      </div>

      <h3
        className={`text-xl font-semibold mb-1.5 ${isHighlighted ? 'text-white' : 'text-[#1d1d1f]'}`}
        style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}
      >
        {plan.name}
      </h3>

      {plan.tagline ? (
        <p className={`text-sm font-light mb-5 leading-snug ${isHighlighted ? 'text-white/65' : 'text-[#6e6e73]'}`}>
          {plan.tagline}
        </p>
      ) : (
        <div className="mb-5" />
      )}

      <div className="mb-1 flex flex-wrap items-end gap-x-2 gap-y-1">
        {!plan.priceAvailable ? (
          <span
            className={`text-2xl font-bold tracking-tight ${isHighlighted ? 'text-white/70' : 'text-[#6e6e73]'}`}
          >
            Price unavailable
          </span>
        ) : (
          <>
            {price.struck != null && (
              <span
                className={`text-xl font-semibold line-through decoration-2 ${
                  isHighlighted ? 'text-white/35' : 'text-gray-400'
                }`}
              >
                {money(price.struck)}
              </span>
            )}
            <span
              className={`text-4xl font-bold tracking-tight ${isHighlighted ? 'text-white' : 'text-[#1d1d1f]'}`}
            >
              {price.isFree ? money(0) : money(price.main)}
            </span>
            <span
              className={`text-sm mb-1.5 font-light ${isHighlighted ? 'text-white/55' : 'text-[#6e6e73]'}`}
            >
              {price.period}
            </span>
          </>
        )}
      </div>

      {plan.priceAvailable && billing === 'annual' && plan.annualAmount != null && savings != null ? (
        <p className={`text-sm font-medium mb-5 ${isHighlighted ? 'text-white/70' : 'text-[#6e6e73]'}`}>
          {money(plan.annualAmount)} billed annually · save {money(savings)}/yr
        </p>
      ) : (
        <div className="mb-5 h-5" aria-hidden />
      )}

      <button
        type="button"
        onClick={handlePlanSelection}
        disabled={!plan.priceAvailable && plan.targetTier !== 'free'}
        className={`w-full py-2.5 rounded-xl text-sm font-semibold mb-6 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 ${ctaClass}`}
      >
        {plan.ctaText}
      </button>

      {/* Credits inset card */}
      <div
        className={`rounded-2xl px-4 py-3.5 mb-6 ${
          isHighlighted ? 'bg-white/8 border border-white/10' : 'bg-[#f5f5f7] border border-gray-100'
        }`}
      >
        <p className={`text-sm font-semibold ${isHighlighted ? 'text-white' : 'text-[#1d1d1f]'}`}>
          {plan.credits.toLocaleString('en-IN')} credits / mo
        </p>
        {plan.creditsLabel ? (
          <p className={`text-xs mt-0.5 font-light ${isHighlighted ? 'text-white/55' : 'text-[#6e6e73]'}`}>
            {plan.creditsLabel}
          </p>
        ) : null}
        <div className={`mt-3 h-1.5 rounded-full overflow-hidden ${isHighlighted ? 'bg-white/15' : 'bg-gray-200'}`}>
          <div
            className={`h-full rounded-full ${isHighlighted ? 'bg-white' : 'bg-[#1d1d1f]'}`}
            style={{
              width: `${Math.min(100, Math.max(8, (plan.credits / 1200) * 100))}%`,
            }}
          />
        </div>
      </div>

      <div className={`border-t mb-5 ${isHighlighted ? 'border-white/10' : 'border-gray-100'}`} />

      <p
        className={`text-[11px] font-semibold uppercase tracking-widest mb-3 ${
          isHighlighted ? 'text-white/45' : 'text-[#6e6e73]'
        }`}
      >
        What&apos;s included
      </p>
      <ul className="space-y-2.5">
        {plan.features.map((feature, idx) => (
          <li key={idx} className="flex items-start gap-2.5">
            <Check
              className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                isHighlighted ? 'text-white' : 'text-[#1d1d1f]'
              }`}
            />
            <span className={`text-sm font-light ${isHighlighted ? 'text-white/80' : 'text-[#1d1d1f]'}`}>
              {feature}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
