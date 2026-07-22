'use client';

import { useEffect, useMemo, useState } from 'react';
import PricingCard from './PricingCard';
import { supabase } from '@/lib/supabaseClient';
import {
  type BillingCycle,
  type DBSubscriptionPlan,
  type PricingPlan,
  mapDbPlan,
  maxAnnualDiscountLabel,
} from './pricingPlans';

const SELECT_COLS =
  'id, plan_name, plan_details, plan_amount, mins, gst, tagline, badge, cta_text, plan_amount_original, annual_amount, annual_discount_rate, credits_label';

/** Fallback select if new columns are not migrated yet */
const SELECT_COLS_LEGACY = 'id, plan_name, plan_details, plan_amount, mins, gst';

export default function PricingGrid() {
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [billing, setBilling] = useState<BillingCycle>('annual');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchPlans = async () => {
      setLoading(true);
      setError(null);

      let { data, error: fetchErr } = await supabase
        .from('subscriptions_plan')
        .select(SELECT_COLS)
        .order('id', { ascending: true });

      // New columns missing → retry with legacy columns only
      if (fetchErr) {
        console.warn('[pricing] full select failed, retrying legacy:', fetchErr.message);
        const legacy = await supabase
          .from('subscriptions_plan')
          .select(SELECT_COLS_LEGACY)
          .order('id', { ascending: true });
        data = legacy.data as typeof data;
        fetchErr = legacy.error;
      }

      if (cancelled) return;

      if (fetchErr) {
        console.error('[pricing]', fetchErr.message);
        setError('Could not load plans. Please try again.');
        setPlans([]);
        setLoading(false);
        return;
      }

      if (!data?.length) {
        setError('No subscription plans found.');
        setPlans([]);
        setLoading(false);
        return;
      }

      setPlans((data as DBSubscriptionPlan[]).map(mapDbPlan));
      setLoading(false);
    };

    void fetchPlans();
    return () => {
      cancelled = true;
    };
  }, []);

  const defaultIndex = useMemo(
    () => Math.max(0, plans.findIndex((p) => p.popular)),
    [plans],
  );

  const saveLabel = maxAnnualDiscountLabel(plans);
  const hasAnnual = plans.some((p) => p.annualAmount != null && p.annualAmount > 0);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 rounded-full border-2 border-gray-200 border-t-[#1d1d1f] animate-spin" />
      </div>
    );
  }

  if (error || plans.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center py-12 px-4">
        <p className="text-sm text-[#6e6e73]">{error || 'No plans available.'}</p>
      </div>
    );
  }

  return (
    <div>
      {hasAnnual && (
        <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
          <div className="inline-flex items-center rounded-full border border-gray-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setBilling('monthly')}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                billing === 'monthly'
                  ? 'bg-[#1d1d1f] text-white'
                  : 'text-[#6e6e73] hover:text-[#1d1d1f]'
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBilling('annual')}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                billing === 'annual'
                  ? 'bg-[#1d1d1f] text-white'
                  : 'text-[#6e6e73] hover:text-[#1d1d1f]'
              }`}
            >
              Annual
            </button>
          </div>
          {saveLabel && (
            <span className="inline-flex items-center rounded-full border border-gray-300 bg-white text-[#1d1d1f] text-xs font-semibold px-3 py-1">
              {saveLabel}
            </span>
          )}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto items-stretch">
        {plans.map((plan, index) => (
          <PricingCard
            key={plan.id}
            plan={plan}
            billing={hasAnnual ? billing : 'monthly'}
            isHighlighted={hoveredIndex === null ? index === defaultIndex : hoveredIndex === index}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          />
        ))}
      </div>
    </div>
  );
}
