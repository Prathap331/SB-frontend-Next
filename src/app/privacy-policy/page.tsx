import React from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const PrivacyPolicyPage = () => {
  return (
    <>
      <Header />
      <main className="container mx-auto px-4 py-8 text-black bg-[#E9EBF0]/20">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-2 text-black">Privacy Policy</h1>
          <p className="mb-8 text-sm text-gray-700"><strong>Last Updated:</strong> 28th Oct, 2025</p>

          <p className="mb-6">
            At <strong>storio</strong> we respect your privacy and are committed to protecting your personal information in compliance with the <strong>Information Technology Act, 2000</strong>, and the <strong>Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011</strong> (“SPDI Rules”).
          </p>

          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-3 text-black">2.1. Information We Collect</h2>
              <p className="mb-4">We may collect the following:</p>
              <ul className="list-disc list-inside pl-4 space-y-2">
                <li><strong>Personal Information:</strong> Name, email, contact number, company name, billing address, GST number.</li>
                <li><strong>Payment Information:</strong> Processed securely by third-party payment gateways.</li>
                <li><strong>Usage Information:</strong> Device logs, browser details, analytics, and interaction data.</li>
                <li><strong>Generated Data:</strong> AI-generated scripts and related usage data for service improvement.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-semibold mb-3 text-black">2.2. Purpose of Data Collection</h2>
              <p className="mb-4">Your data is used for:</p>
              <ul className="list-disc list-inside pl-4 space-y-2">
                <li>Providing, maintaining, and improving the platform.</li>
                <li>Account management and billing.</li>
                <li>Sending service updates and support communication.</li>
                <li>Ensuring compliance, fraud prevention, and platform security.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-semibold mb-3 text-black">2.3. Data Sharing and Disclosure</h2>
              <p className="mb-4">We <strong>do not sell or trade</strong> your data. We may share information with:</p>
              <ul className="list-disc list-inside pl-4 space-y-2">
                <li>Authorized service providers (payment, hosting, analytics).</li>
                <li>Government authorities when legally required under Indian law.</li>
                <li>Business partners with your explicit consent.</li>
              </ul>
              <p className="mt-4">All vendors follow data security standards aligned with the IT Act and SPDI Rules.</p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold mb-3 text-black">2.4. Data Retention</h2>
              <p>Your personal data will be retained only for as long as necessary to fulfill the purpose for which it was collected or as required by applicable law.</p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold mb-3 text-black">2.5. Data Security Measures</h2>
              <p className="mb-4">We employ:</p>
              <ul className="list-disc list-inside pl-4 space-y-2">
                <li>SSL encryption, firewalls, and secure servers.</li>
                <li>Restricted access to sensitive data.</li>
                <li>Regular audits for compliance with <strong>ISO/IEC 27001</strong> and <strong>Reasonable Security Practices</strong> as per IT Rules.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-semibold mb-3 text-black">2.6. User Rights (Under Indian IT Act)</h2>
              <p className="mb-4">You may:</p>
              <ul className="list-disc list-inside pl-4 space-y-2">
                <li>Request access or correction of your personal data.</li>
                <li>Withdraw consent for data processing.</li>
                <li>Request deletion of your account and associated data.</li>
              </ul>
              <p className="mt-4">Contact: <strong>Support@storio.tech</strong></p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold mb-3 text-black">2.7. Grievance Officer</h2>
              <p className="mb-4">In compliance with Rule 5(9) of the SPDI Rules, the Grievance Officer for data protection issues is:</p>
              <ul className="list-none pl-4 space-y-1">
                <li><strong>Name:</strong> Prathap Kothapalli</li>
                <li><strong>Email:</strong> pj@storio.tech</li>
                <li><strong>Address:</strong> Flat no. 502, Meenakshi enclave MIG 891, KPHB phase 3, Hyderabad, 500072</li>
                <li><strong>Response Time:</strong> Within 30 days of complaint receipt.</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
};

export default PrivacyPolicyPage;
