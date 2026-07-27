'use client';

import { Button } from '@/components/ui/button';

const SALES_EMAIL = 'support@storio.tech';
const MAILTO_HREF = `mailto:${SALES_EMAIL}?subject=${encodeURIComponent('Sales inquiry — Storio')}`;

export default function ContactSalesButton() {
  return (
    <Button variant="outline" size="lg" asChild>
      <a href={MAILTO_HREF}>Contact Sales</a>
    </Button>
  );
}
