'use client';

import type { LucideIcon } from 'lucide-react';
import { Crown, Zap, Target } from 'lucide-react';

export type BillingCycle = 'monthly' | 'annual';

/** Row shape from subscriptions_plan (existing + new columns). */
export type DBSubscriptionPlan = {
  id: number;
  plan_name: string;
  plan_details: string[] | string;
  plan_amount: number;
  mins: number;
  gst?: number | null;
  /** Short line under the plan name */
  tagline?: string | null;
  /** e.g. "Most Popular", "20% Off" */
  badge?: string | null;
  /** CTA label, e.g. "Upgrade to Plus" */
  cta_text?: string | null;
  /** Pre-discount monthly list price (strikethrough in monthly view) */
  plan_amount_original?: number | null;
  /** Total INR billed once per year */
  annual_amount?: number | null;
  /** e.g. 0.15 for 15% yearly savings badge */
  annual_discount_rate?: number | null;
  /** e.g. "≈ 100 min script + 10 thumbnails" */
  credits_label?: string | null;
};

export interface PricingPlan {
  id: number;
  name: string;
  targetTier: string;
  tagline: string;
  badge: string | null;
  ctaText: string;
  features: string[];
  /** Credits / month — stored in `mins` today */
  credits: number;
  creditsLabel: string;
  /** Current monthly price (INR) */
  monthlyAmount: number;
  /** Original monthly list price before promo (INR), optional */
  monthlyAmountOriginal: number | null;
  /** Total yearly bill (INR), null for free */
  annualAmount: number | null;
  annualDiscountRate: number | null;
  gst: number;
  popular: boolean;
  icon: LucideIcon;
}

const PLAN_ICONS: Record<string, LucideIcon> = {
  free: Target,
  plus: Zap,
  pro: Crown,
};

function parseDetails(raw: string[] | string): string[] {
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function mapDbPlan(row: DBSubscriptionPlan): PricingPlan {
  const key = row.plan_name.trim().toLowerCase();
  const monthly = Number(row.plan_amount) || 0;
  const original =
    row.plan_amount_original != null && Number(row.plan_amount_original) > 0
      ? Number(row.plan_amount_original)
      : null;
  const annual =
    row.annual_amount != null && Number(row.annual_amount) > 0
      ? Number(row.annual_amount)
      : null;
  const discountRate =
    row.annual_discount_rate != null && Number(row.annual_discount_rate) > 0
      ? Number(row.annual_discount_rate)
      : null;

  const badge = (row.badge || '').trim() || null;
  const popular =
    badge?.toLowerCase().includes('popular') || key === 'plus';

  return {
    id: row.id,
    name: row.plan_name.trim(),
    targetTier: key,
    tagline: (row.tagline || '').trim(),
    badge,
    ctaText:
      (row.cta_text || '').trim() ||
      (monthly === 0 ? 'Start free' : `Upgrade to ${row.plan_name.trim()}`),
    features: parseDetails(row.plan_details),
    credits: Number(row.mins) || 0,
    creditsLabel: (row.credits_label || '').trim(),
    monthlyAmount: monthly,
    monthlyAmountOriginal: original,
    annualAmount: annual,
    annualDiscountRate: discountRate,
    gst: Number(row.gst) || 0,
    popular,
    icon: PLAN_ICONS[key] ?? Target,
  };
}

export function formatInr(amount: number): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

/** Price shown as the big number for the selected billing cycle */
export function displayPrice(
  plan: PricingPlan,
  billing: BillingCycle,
): { main: number; struck: number | null; period: string; isFree: boolean } {
  if (plan.monthlyAmount === 0) {
    return { main: 0, struck: null, period: 'forever', isFree: true };
  }
  if (billing === 'annual' && plan.annualAmount != null) {
    const monthlyEquiv = plan.annualAmount / 12;
    return {
      main: monthlyEquiv,
      struck: plan.monthlyAmount,
      period: '/month, billed yearly',
      isFree: false,
    };
  }
  return {
    main: plan.monthlyAmount,
    struck: plan.monthlyAmountOriginal,
    period: '/month',
    isFree: false,
  };
}

export function annualSavings(plan: PricingPlan): number | null {
  if (!plan.annualAmount || plan.monthlyAmount <= 0) return null;
  const save = plan.monthlyAmount * 12 - plan.annualAmount;
  return save > 0 ? save : null;
}

/** Highest annual discount across paid plans — for the toggle pill */
export function maxAnnualDiscountLabel(plans: PricingPlan[]): string | null {
  const rates = plans
    .map((p) => p.annualDiscountRate)
    .filter((r): r is number => r != null && r > 0);
  if (!rates.length) return null;
  const pct = Math.round(Math.max(...rates) * 100);
  return `Save ${pct}% billed yearly`;
}
