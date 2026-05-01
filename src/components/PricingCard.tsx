'use client';

import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { LucideIcon } from 'lucide-react';
import { PricingPlan } from './pricingPlans';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';

export interface PlanProps {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  limitations: string[];
  buttonText: string;
  buttonVariant: 'outline' | 'default';
  popular: boolean;
  icon: LucideIcon;
}

interface PricingCardProps {
  plan: PricingPlan;
  isHighlighted: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export default function PricingCard({ plan, isHighlighted, onMouseEnter, onMouseLeave }: PricingCardProps) {
  const router = useRouter();
  const IconComponent = plan.icon;

  const handlePlanSelection = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error('Authentication Required', { description: 'Please login to continue with subscription.', duration: 3000 });
      router.push('/auth');
      return;
    }
    if (plan.amount === 0 || plan.targetTier === 'free') {
      router.push('/');
      return;
    }
    router.push(`/checkout?tier=${plan.targetTier}`);
  };

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`relative flex flex-col rounded-3xl p-8 transition-all duration-300 cursor-default ${
        isHighlighted
          ? 'bg-[#1d1d1f] text-white shadow-2xl shadow-black/20 scale-[1.03]'
          : 'bg-white border border-gray-200 shadow-sm'
      }`}
    >
      {/* Popular badge — only on the originally popular card */}
      {plan.popular && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <span className={`text-[11px] font-semibold px-4 py-1 rounded-full shadow-sm border transition-all duration-300 ${
            isHighlighted
              ? 'bg-white text-[#1d1d1f] border-gray-100'
              : 'bg-[#1d1d1f] text-white border-transparent'
          }`}>
            Most Popular
          </span>
        </div>
      )}

      {/* Icon */}
      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-5 transition-colors duration-300 ${isHighlighted ? 'bg-white/10' : 'bg-[#f5f5f7]'}`}>
        <IconComponent className={`w-5 h-5 transition-colors duration-300 ${isHighlighted ? 'text-white' : 'text-[#1d1d1f]'}`} />
      </div>

      {/* Plan name */}
      <h3
        className={`text-lg font-semibold mb-1 transition-colors duration-300 ${isHighlighted ? 'text-white' : 'text-[#1d1d1f]'}`}
        style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}
      >
        {plan.name}
      </h3>

      {/* Price */}
      <div className="mb-3 flex items-end gap-1">
        <span className={`text-4xl font-bold tracking-tight transition-colors duration-300 ${isHighlighted ? 'text-white' : 'text-[#1d1d1f]'}`}>
          {plan.price}
        </span>
        <span className={`text-sm mb-1.5 font-light transition-colors duration-300 ${isHighlighted ? 'text-white/60' : 'text-[#6e6e73]'}`}>
          {plan.period}
        </span>
      </div>

      {/* Description */}
      <p className={`text-sm font-light mb-6 transition-colors duration-300 ${isHighlighted ? 'text-white/70' : 'text-[#6e6e73]'}`}>
        {plan.description}
      </p>

      {/* CTA Button */}
      <button
        onClick={handlePlanSelection}
        className={`w-full py-2.5 rounded-xl text-sm font-medium mb-7 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${
          isHighlighted
            ? 'bg-white text-[#1d1d1f] hover:bg-gray-100'
            : 'bg-[#1d1d1f] text-white hover:bg-black'
        }`}
      >
        {plan.buttonText}
      </button>

      {/* Divider */}
      <div className={`border-t mb-6 transition-colors duration-300 ${isHighlighted ? 'border-white/10' : 'border-gray-100'}`} />

      {/* Features */}
      <div>
        <p className={`text-[11px] font-semibold uppercase tracking-widest mb-3 transition-colors duration-300 ${isHighlighted ? 'text-white/50' : 'text-[#6e6e73]'}`}>
          What&apos;s included
        </p>
        <ul className="space-y-2.5">
          {plan.features.map((feature, idx) => (
            <li key={idx} className="flex items-start gap-2.5">
              <Check className={`w-4 h-4 flex-shrink-0 mt-0.5 transition-colors duration-300 ${isHighlighted ? 'text-green-400' : 'text-green-600'}`} />
              <span className={`text-sm font-light transition-colors duration-300 ${isHighlighted ? 'text-white/80' : 'text-[#1d1d1f]'}`}>
                {feature}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
