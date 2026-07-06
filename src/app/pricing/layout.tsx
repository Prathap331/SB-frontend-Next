import type { Metadata } from 'next';
import JsonLd from '@/components/seo/JsonLd';
import { absoluteUrl, createPageMetadata } from '@/lib/seo';

export const metadata: Metadata = createPageMetadata({
  title: 'Pricing — Simple, Transparent Plans',
  description:
    'Choose the right Storio plan for your YouTube content workflow. Start free and upgrade when you need more AI script generation credits.',
  path: '/pricing',
  keywords:
    'storio pricing, AI script generator pricing, YouTube script tool plans, content creator subscription',
});

const pricingJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: 'Storio AI Script Generator',
  description:
    'AI-powered YouTube scriptwriting platform with flexible subscription plans for content creators.',
  brand: {
    '@type': 'Brand',
    name: 'Storio',
  },
  offers: {
    '@type': 'AggregateOffer',
    priceCurrency: 'INR',
    lowPrice: '0',
    offerCount: '3',
    url: absoluteUrl('/pricing'),
  },
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <JsonLd data={pricingJsonLd} />
      {children}
    </>
  );
}
