'use client';

import { Button } from '@/components/ui/button';

const SALES_EMAIL = 'support@storio.tech';

export default function ContactSalesButton() {
  return (
    <Button
      variant="outline"
      size="lg"
      onClick={() => {
        window.location.href = `mailto:${SALES_EMAIL}`;
      }}
    >
      Contact Sales
    </Button>
  );
}