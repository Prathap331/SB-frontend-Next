import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { ArrowLeft } from 'lucide-react';

const sections = [
  {
    title: 'Cancellation',
    body: `You may cancel your StoryBit subscription at any time from your account settings or by contacting our support team. Cancellations take effect at the end of the current billing period — you will retain full access to your plan features until that date.`,
  },
  {
    title: 'Refund policy',
    body: `StoryBit does not offer refunds for partial months or unused script generation minutes. If you cancel mid-cycle, your subscription remains active until the billing period ends and you will not be charged again. We may, at our sole discretion, issue a refund in exceptional circumstances.`,
  },
  {
    title: 'Auto-renewal',
    body: `Paid plans automatically renew at the end of each billing period using the payment method on file. You will receive a reminder email 3 days before each renewal. To avoid being charged for the next period, cancel at least 24 hours before your renewal date.`,
  },
  {
    title: 'Free plan',
    body: `The Free plan is a one-time allocation and is not subject to recurring charges. No cancellation is required for free accounts.`,
  },
  {
    title: 'Downgrading',
    body: `If you downgrade from a higher plan to a lower one, the change takes effect at the start of your next billing cycle. You will continue to enjoy the benefits of the current plan until then.`,
  },
  {
    title: 'Contact us',
    body: `If you have questions about billing or need help cancelling, reach us at support.storybit@gmail.com. We aim to respond within one business day.`,
  },
];

export default function CancellationPolicy() {
  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <Header />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-14">

        {/* Back link */}
        <Link
          href="/pricing"
          className="inline-flex items-center gap-1.5 text-xs text-[#6e6e73] hover:text-[#1d1d1f] transition-colors mb-8"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Pricing
        </Link>

        {/* Hero */}
        <div className="mb-8">
          <h1
            className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#1d1d1f] mb-2"
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}
          >
            Cancellation Policy
          </h1>
          <p className="text-sm text-[#6e6e73] font-light">
            Last updated: {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden divide-y divide-gray-100">
          {sections.map((s, i) => (
            <div key={i} className="px-6 sm:px-8 py-6">
              <h2 className="text-sm font-semibold text-[#1d1d1f] mb-2">{s.title}</h2>
              <p className="text-sm text-[#6e6e73] font-light leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-[#6e6e73] mt-8 font-light">
          These terms may change. Continued use of StoryBit after changes constitutes acceptance.
        </p>
      </div>

      <Footer />
    </div>
  );
}
