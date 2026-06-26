import React from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const CancellationAndRefundPolicyPage = () => {
  return (
    <>
      <Header />
      <main className="container mx-auto px-4 py-8 text-black bg-[#E9EBF0]/20">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-2 text-black">Cancellation & Refund Policy</h1>
          <p className="mb-8 text-sm text-gray-700"><strong>Last Updated:</strong> 28th Oct, 2025</p>

          <p className="mb-6">
            This policy explains how subscription cancellations and refunds are handled for users of <strong>Storio.</strong>
          </p>

          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-3 text-black">3.1. Cancellation Policy</h2>
              <ul className="list-disc list-inside pl-4 space-y-2">
                <li>Users can cancel their subscription at any time from their account dashboard or by contacting support.</li>
                <li>If cancellation occurs <strong>within 12 hours of payment</strong>, a <strong>full refund (100%)</strong> will be issued.</li>
                <li>Cancellations made <strong>after 12 hours</strong> will stop automatic renewals but will <strong>not refund</strong> the current cycle.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-semibold mb-3 text-black">3.2. Refunds for Downtime or Technical Issues</h2>
              <p className="mb-4">If the platform remains <strong>non-operational for 7 consecutive days or more</strong> due to internal technical issues (not user-side issues), you are eligible for:</p>
              <ul className="list-disc list-inside pl-4 space-y-2">
                <li>A <strong>pro-rata refund</strong> for the affected period, or</li>
                <li>An <strong>extension of your subscription validity</strong> (at our discretion).</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-semibold mb-3 text-black">3.3. Refund Process</h2>
              <ul className="list-disc list-inside pl-4 space-y-2">
                <li>Refunds will be initiated to the <strong>original payment method</strong> within <strong>7–10 business days</strong> post-approval.</li>
                <li>To claim a refund, email <strong>Support@storio.tech</strong> with your account details and proof of issue (e.g., screenshots, downtime logs).</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-semibold mb-3 text-black">3.4. Non-Refundable Circumstances</h2>
              <p className="mb-4">Refunds will <strong>not</strong> be issued for:</p>
              <ul className="list-disc list-inside pl-4 space-y-2">
                <li>Partial usage or user dissatisfaction with AI-generated results.</li>
                <li>Service interruptions caused by internet/connectivity issues on the user’s end.</li>
                <li>Breach of terms, abusive activity, or fraudulent account usage.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-semibold mb-3 text-black">3.5. Compliance</h2>
              <p>This policy is framed under the <strong>Consumer Protection (E-commerce) Rules, 2020</strong>, and the <strong>Information Technology Act, 2000.</strong></p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
};

export default CancellationAndRefundPolicyPage;
