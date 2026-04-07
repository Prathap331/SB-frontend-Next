import Header from '../../components/Header';
import Footer from '../../components/Footer';
import PricingGrid from '@/components/PricingGrid';
import ContactSalesButton from '@/components/ContactSalesButton';
import ComingFeatures from '@/components/ComingFeatures';

export default function Pricing() {
  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Hero */}
      <section className="bg-[#f5f5f7] pt-16 pb-20 px-5 sm:px-8 text-center">
        <div className="inline-flex items-center gap-1.5 bg-white border border-gray-200 text-[#6e6e73] text-xs font-medium px-3.5 py-1 rounded-full mb-6 shadow-sm">
          Simple, transparent pricing
        </div>
        <h1
          className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight text-[#1d1d1f] mb-4 leading-tight"
          style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}
        >
          Choose your plan.
        </h1>
        <p className="text-lg text-[#6e6e73] font-light max-w-xl mx-auto">
          Start free, upgrade when you&apos;re ready. No hidden fees.
        </p>
      </section>

      {/* Cards */}
      <section className="bg-white py-16 px-5 sm:px-8">
        <PricingGrid />
      </section>

      {/* Help */}
      <section className="bg-[#f5f5f7] py-16 px-5 sm:px-8 text-center">
        <h2
          className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1d1d1f] mb-3"
          style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}
        >
          Not sure which plan fits?
        </h2>
        <p className="text-[#6e6e73] text-base font-light mb-6 max-w-md mx-auto">
          Start with the free tier and upgrade anytime. Our team is happy to help you find the right fit.
        </p>
        <ContactSalesButton />

      </section>
        <ComingFeatures />

      <Footer />
    </div>
  );
}
