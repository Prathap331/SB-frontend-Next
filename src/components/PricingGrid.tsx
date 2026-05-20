'use client';

import { useState, useEffect } from 'react';
import PricingCard from './PricingCard';
import { pricingPlans, PricingPlan } from './pricingPlans';
import { supabase } from '@/lib/supabaseClient';
import { Crown, Zap, Target } from 'lucide-react';
import { LucideIcon } from 'lucide-react';

const PLAN_ICONS: Record<string, LucideIcon> = { free: Target, plus: Zap, pro: Crown };
const PLAN_BUTTONS: Record<string, string> = { free: 'Get Started', plus: 'Choose Plus', pro: 'Choose Pro' };
const PLAN_DESCRIPTIONS: Record<string, string> = {
  free: 'Perfect for trying out our AI scriptwriting',
  plus: 'Great for regular content creators',
  pro: 'For professional content creators and teams',
};

type DBPlan = {
  id: number;
  plan_name: string;
  plan_details: string[] | string;
  plan_amount: number;
  mins: number;
};

function buildPlan(row: DBPlan): PricingPlan {
  const key = row.plan_name.toLowerCase();
  const isFree = row.plan_amount === 0;
  const features = Array.isArray(row.plan_details)
    ? row.plan_details
    : JSON.parse(row.plan_details as string);
  return {
    name: row.plan_name,
    price: isFree ? '₹0' : `₹${row.plan_amount}`,
    period: isFree ? 'One-time' : '/month',
    description: PLAN_DESCRIPTIONS[key] ?? '',
    features,
    limitations: [],
    buttonText: PLAN_BUTTONS[key] ?? `Choose ${row.plan_name}`,
    buttonVariant: isFree ? 'outline' : 'default',
    popular: key === 'plus',
    icon: PLAN_ICONS[key] ?? Target,
    amount: row.plan_amount,
    targetTier: key,
  };
}

export default function PricingGrid() {
  const [plans, setPlans] = useState<PricingPlan[]>(pricingPlans);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => {
    const fetchPlans = async () => {
      const { data, error } = await supabase
        .from('subscriptions_plan')
        .select('id, plan_name, plan_details, plan_amount, mins')
        .order('id', { ascending: true });
      if (!error && data && data.length > 0) {
        setPlans((data as DBPlan[]).map(buildPlan));
      }
    };
    fetchPlans();
  }, []);

  const defaultIndex = plans.findIndex(p => p.popular);

  return (
    <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
      {plans.map((plan, index) => (
        <PricingCard
          key={plan.name}
          plan={plan}
          isHighlighted={hoveredIndex === null ? index === defaultIndex : hoveredIndex === index}
          onMouseEnter={() => setHoveredIndex(index)}
          onMouseLeave={() => setHoveredIndex(null)}
        />
      ))}
    </div>
  );
}
