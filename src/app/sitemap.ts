import type { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';
import { absoluteUrl, PUBLIC_ROUTES } from '@/lib/seo';

async function getTopicUrls(): Promise<MetadataRoute.Sitemap> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) return [];

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data } = await supabase
      .from('scripts_universal')
      .select('topic, created_at')
      .not('topic', 'is', null)
      .order('created_at', { ascending: false })
      .limit(500);

    if (!data?.length) return [];

    const seen = new Set<string>();

    return data.reduce<MetadataRoute.Sitemap>((entries, row) => {
      const topic = row.topic?.trim();
      if (!topic) return entries;

      const key = topic.toLowerCase();
      if (seen.has(key)) return entries;
      seen.add(key);

      entries.push({
        url: absoluteUrl(`/search/${encodeURIComponent(topic)}`),
        lastModified: row.created_at ? new Date(row.created_at) : new Date(),
        changeFrequency: 'weekly',
        priority: 0.7,
      });

      return entries;
    }, []);
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = PUBLIC_ROUTES.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified: new Date(),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const topicEntries = await getTopicUrls();

  return [...staticEntries, ...topicEntries];
}
