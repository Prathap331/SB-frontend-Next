import { Mail, Phone } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

const Footer = () => {
  return (
    <footer className="bg-[#1d1d1f] text-white">
      {/* Main content */}
      <div className="max-w-6xl mx-auto px-5 sm:px-8 pt-10 sm:pt-14 pb-8 sm:pb-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 sm:gap-10 lg:gap-16">
          {/* Brand */}
          <div className="sm:col-span-2 md:col-span-1">
            <Link href="/" className="inline-block hover:opacity-80 transition-opacity mb-4">
              <Image
                src="/White logo.png"
                alt="Storybit"
                width={120}
                height={30}
                className="h-7 w-auto"
                style={{ width: 'auto' }}
              />
            </Link>
            <p className="text-[#6e6e73] text-sm leading-relaxed font-light">
              AI-powered scriptwriting for content creators worldwide.
            </p>
          </div>

          {/* Address */}
          <div>
            <h4 className="text-xs font-semibold text-[#a1a1a6] uppercase tracking-widest mb-4">
              Address
            </h4>
            <address className="not-italic text-sm text-[#6e6e73] font-light space-y-1 leading-relaxed">
              <p>Plot no. MIG 891,</p>
              <p>KPHB Phase 3, Kukatpally,</p>
              <p>Hyderabad, Telangana,</p>
              <p>India — 500072</p>
            </address>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-xs font-semibold text-[#a1a1a6] uppercase tracking-widest mb-4">
              Contact
            </h4>
            <div className="space-y-3">
              <a
                href="mailto:support@storybit.tech"
                className="flex items-center gap-2 text-sm text-[#6e6e73] hover:text-white transition-colors font-light"
              >
                <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                support@storybit.tech
              </a>
              <a
                href="tel:+919000449855"
                className="flex items-center gap-2 text-sm text-[#6e6e73] hover:text-white transition-colors font-light"
              >
                <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                +91 90004 49855
              </a>
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-xs font-semibold text-[#a1a1a6] uppercase tracking-widest mb-4">
              Legal
            </h4>
            <div className="space-y-3">
              <Link
                href="/terms-and-conditions"
                className="block text-sm text-[#6e6e73] hover:text-white transition-colors font-light"
              >
                Terms &amp; Conditions
              </Link>
              <Link
                href="/privacy-policy"
                className="block text-sm text-[#6e6e73] hover:text-white transition-colors font-light"
              >
                Privacy Policy
              </Link>
              <Link
                href="/cancellation-and-refund-policy"
                className="block text-sm text-[#6e6e73] hover:text-white transition-colors font-light"
              >
                Cancellation &amp; Refund
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-5">
          <p className="text-xs text-[#6e6e73] font-light">
            © 2025 Morpho Technologies Pvt Ltd. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
