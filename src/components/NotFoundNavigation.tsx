'use client';

import PrefixedLink from '@/components/PrefixedLink';
import { Button } from '@/components/client-components/button';
import { useKeywordNavigation } from '@/hooks/use-keyword-navigation';
import { Home, ArrowLeft } from 'lucide-react';

export default function NotFoundNavigation() {
  const { homePath } = useKeywordNavigation();

  return (
    <div className="flex flex-col sm:flex-row gap-4 justify-center">
      <PrefixedLink href={homePath}>
        <Button className="flex items-center">
          <Home className="w-4 h-4 mr-2" />
          Go Home
        </Button>
      </PrefixedLink>
      <Button variant="outline" onClick={() => window.history.back()}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        Go Back
      </Button>
    </div>
  );
}