import React from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const TermsAndConditionsPage = () => {
  return (
    <>
      <Header />
      <main className="container mx-auto px-4 py-8 bg-[#E9EBF0]/20 text-black">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-2 text-black">Terms & Conditions</h1>
          <p className="mb-8 text-sm text-gray-700"><strong>Last Updated:</strong> 28th Oct, 2025</p>

          <p className="mb-6">
            Welcome to <strong>storio (Morpho technologies Pvt Ltd)</strong> (“Company”, “we”, “us”, “our”). These Terms and Conditions (“Terms”) govern your access to and use of our platform, software, and services available at <strong>https://www.storio.tech/</strong> (“Platform”). By accessing or using our services, you agree to comply with these Terms.
          </p>

          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-3 text-black">1.1. Eligibility</h2>
              <p className="mb-4">By registering or using our services, you represent that:</p>
              <ul className="list-disc list-inside pl-4 space-y-2">
                <li>You are at least <strong>18 years of age</strong>, and</li>
                <li>You are using the service for <strong>personal</strong> or <strong>business or professional purposes</strong></li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-semibold mb-3 text-black">1.2. Account Registration</h2>
              <p className="mb-4">You must create an account to access our services. You agree to:</p>
              <ul className="list-disc list-inside pl-4 space-y-2">
                <li>Provide accurate information.</li>
                <li>Maintain confidentiality of your login credentials.</li>
                <li>Accept responsibility for all activities occurring under your account.</li>
              </ul>
              <p className="mt-4">The Company is not liable for unauthorized access resulting from your failure to maintain account security.</p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold mb-3 text-black">1.3. Subscription and Payment Terms</h2>
              <ul className="list-disc list-inside pl-4 space-y-2">
                <li>Our services are available on a <strong>subscription basis</strong> with different plans displayed on our website.</li>
                <li>All fees are Inclusive of Goods and Services Tax (GST), which will be applied as per applicable law.</li>
                <li>Payments are processed through secure third-party gateways compliant with <strong>RBI and PCI-DSS</strong> standards.</li>
                <li>We reserve the right to modify fees or plans at any time with reasonable notice.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-semibold mb-3 text-black">1.4. Acceptable Use Policy</h2>
              <p className="mb-4">You agree <strong>not to:</strong></p>
              <ul className="list-disc list-inside pl-4 space-y-2">
                <li>Upload, generate, or distribute unlawful, obscene, or infringing content.</li>
                <li>Use the platform for spamming, impersonation, or automated scraping.</li>
                <li>Reverse-engineer or copy the underlying source code or AI model.</li>
                <li>Violate any applicable laws or third-party rights.</li>
              </ul>
              <p className="mt-4">Violation of this policy may lead to immediate suspension or termination.</p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold mb-3 text-black">1.5. Intellectual Property</h2>
              <ul className="list-disc list-inside pl-4 space-y-2">
                <li>All rights, title, and interest in the platform, including software, design, trademarks, and content, remain our exclusive property.</li>
                <li>You retain full rights to the <strong>original content you create</strong> using our platform.</li>
                <li>By using the platform, you grant us a limited, non-exclusive license to process and store your data solely for delivering the service.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-semibold mb-3 text-black">1.6. Service Availability</h2>
              <p>We strive for continuous uptime, but interruptions may occur due to maintenance or unforeseen issues. If downtime exceeds 7 consecutive days, users may claim compensation per our <strong>Refund Policy.</strong></p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold mb-3 text-black">1.7. Limitation of Liability</h2>
              <p className="mb-4">To the maximum extent permitted by Indian law:</p>
              <ul className="list-disc list-inside pl-4 space-y-2">
                <li>We are not liable for indirect, incidental, or consequential damages.</li>
                <li>Our aggregate liability is limited to the subscription fee paid in the preceding billing cycle.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-semibold mb-3 text-black">1.8. Termination</h2>
              <ul className="list-disc list-inside pl-4 space-y-2">
                <li>We may terminate or suspend access without prior notice if you breach these Terms.</li>
                <li>You may terminate your subscription anytime via your account or by contacting support. See our <strong>Cancellation & Refund Policy</strong> for refund eligibility.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-semibold mb-3 text-black">1.9. Governing Law and Jurisdiction</h2>
              <p>These Terms are governed by and construed in accordance with the <strong>laws of India</strong>, and any disputes shall be subject to the exclusive jurisdiction of the <strong>courts of Hyderabad, Telangana state, India.</strong></p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
};

export default TermsAndConditionsPage;
