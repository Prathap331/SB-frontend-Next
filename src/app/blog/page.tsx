import { Suspense } from 'react';
import BlogPageClient from './BlogPageClient';

function BlogPageFallback() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <p className="text-[#6e6e73] text-sm">Loading blog...</p>
    </div>
  );
}

export default function BlogPage() {
  return (
    <Suspense fallback={<BlogPageFallback />}>
      <BlogPageClient />
    </Suspense>
  );
}
