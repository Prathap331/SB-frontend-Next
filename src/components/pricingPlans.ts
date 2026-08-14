'use client';

import type { LucideIcon } from 'lucide-react';
import { Crown, Zap, Target } from 'lucide-react';

export type BillingCycle = 'monthly' | 'annual';
export type PricingCurrency = 'INR' | 'USD';

/**
 * Row shape from subscriptions_plan.
 * USD columns match Postgres-lowercased names from:
 * usd_planAmount, usd_annualAmount, usd_gst, usd_planamountoriginal
 */
export type DBSubscriptionPlan = {
  id: number;
  plan_name: string;
  plan_details: string[] | string;
  plan_amount: number;
  mins: number;
  gst?: number | null;
  tagline?: string | null;
  badge?: string | null;
  cta_text?: string | null;
  plan_amount_original?: number | null;
  annual_amount?: number | null;
  annual_discount_rate?: number | null;
  credits_label?: string | null;
  usd_planamount?: number | null;
  usd_annualamount?: number | null;
  usd_gst?: number | null;
  usd_planamountoriginal?: number | null;
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
  /** Current monthly price in the selected currency */
  monthlyAmount: number;
  /** Original monthly list price before promo, optional */
  monthlyAmountOriginal: number | null;
  /** Total yearly bill, null for free / when not set */
  annualAmount: number | null;
  annualDiscountRate: number | null;
  gst: number;
  popular: boolean;
  icon: LucideIcon;
  currency: PricingCurrency;
  /**
   * False when USD is selected but usd_* amount columns are null for a paid plan.
   * No INR fallback — upgrade should be disabled.
   */
  priceAvailable: boolean;
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

function numOrNull(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function mapDbPlan(
  row: DBSubscriptionPlan,
  currency: PricingCurrency = 'USD',
): PricingPlan {
  const key = row.plan_name.trim().toLowerCase();
  const isFree = key === 'free' || Number(row.plan_amount) === 0;

  let monthly: number;
  let original: number | null;
  let annual: number | null;
  let gst: number;
  let priceAvailable = true;

  if (currency === 'USD') {
    const usdMonthly = numOrNull(row.usd_planamount);
    const usdOriginal = numOrNull(row.usd_planamountoriginal);
    const usdAnnual = numOrNull(row.usd_annualamount);
    const usdGst = numOrNull(row.usd_gst);

    if (isFree) {
      monthly = 0;
      original = null;
      annual = null;
      gst = usdGst ?? 0;
    } else if (usdMonthly == null && (usdAnnual == null || usdAnnual <= 0)) {
      monthly = 0;
      original = null;
      annual = null;
      gst = 0;
      priceAvailable = false;
    } else {
      monthly = usdMonthly ?? 0;
      original = usdOriginal != null && usdOriginal > 0 ? usdOriginal : null;
      annual = usdAnnual != null && usdAnnual > 0 ? usdAnnual : null;
      gst = usdGst ?? 0;
      // Monthly upgrade needs a monthly amount; annual-only is ok when annual is set
      if (usdMonthly == null && annual == null) priceAvailable = false;
    }
  } else {
    monthly = Number(row.plan_amount) || 0;
    original =
      row.plan_amount_original != null && Number(row.plan_amount_original) > 0
        ? Number(row.plan_amount_original)
        : null;
    annual =
      row.annual_amount != null && Number(row.annual_amount) > 0
        ? Number(row.annual_amount)
        : null;
    gst = Number(row.gst) || 0;
  }

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
      (isFree ? 'Start free' : `Upgrade to ${row.plan_name.trim()}`),
    features: parseDetails(row.plan_details),
    credits: Number(row.mins) || 0,
    creditsLabel: (row.credits_label || '').trim(),
    monthlyAmount: monthly,
    monthlyAmountOriginal: original,
    annualAmount: annual,
    annualDiscountRate: discountRate,
    gst,
    popular,
    icon: PLAN_ICONS[key] ?? Target,
    currency,
    priceAvailable,
  };
}

export function formatInr(amount: number): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

export function formatUsd(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  return `$${rounded.toLocaleString('en-US', {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatMoney(amount: number, currency: PricingCurrency): string {
  return currency === 'USD' ? formatUsd(amount) : formatInr(amount);
}

/** Price shown as the big number for the selected billing cycle */
export function displayPrice(
  plan: PricingPlan,
  billing: BillingCycle,
): { main: number; struck: number | null; period: string; isFree: boolean } {
  if (plan.monthlyAmount === 0 && plan.priceAvailable) {
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
