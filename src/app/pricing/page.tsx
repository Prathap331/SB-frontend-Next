'use client';

import StudioShell from '@/components/studio/StudioShell';
import PricingGrid from '@/components/PricingGrid';
import CreditsHowItWorks from '@/components/CreditsHowItWorks';
import ContactSalesButton from '@/components/ContactSalesButton';

export default function Pricing() {
  return (
    <StudioShell>
      <div className="text-center mb-8 sm:mb-10">
        <div className="inline-flex items-center gap-1.5 bg-white border border-gray-200 text-[#6e6e73] text-xs font-medium px-3.5 py-1 rounded-full mb-4 shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          Simple, transparent pricing
        </div>
        <h1
          className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-[#1d1d1f] mb-3 leading-tight"
          style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}
        >
          Choose your plan.
        </h1>
        <p className="text-base sm:text-lg text-[#6e6e73] font-light max-w-xl mx-auto">
          Start free, upgrade when you&apos;re ready. No hidden fees.
        </p>
      </div>

      <PricingGrid />

      <CreditsHowItWorks />

      <div className="mt-12 sm:mt-16 text-center bg-white border border-gray-200/80 rounded-2xl px-6 py-8 shadow-sm">
        <h2
          className="text-xl sm:text-2xl font-semibold tracking-tight text-[#1d1d1f] mb-3"
          style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}
        >
          Not sure which plan fits?
        </h2>
        <p className="text-[#6e6e73] text-sm sm:text-base font-light mb-6 max-w-md mx-auto">
          Start with the free tier and upgrade anytime. Our team is happy to help you find the right fit.
        </p>
        <ContactSalesButton />
      </div>
    </StudioShell>
  );
}
