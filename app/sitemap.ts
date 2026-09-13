import type { MetadataRoute } from 'next';
import { articles } from '@/lib/articles';
import { absoluteUrl, categorySlug } from '@/lib/seo';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const categories = [...new Set(articles.map((article) => categorySlug(article.category)))];

  return [
    { url: absoluteUrl('/'), lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: absoluteUrl('/search/'), lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: absoluteUrl('/subscribe/'), lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    ...categories.map((category) => ({ url: absoluteUrl(`/category/${category}/`), lastModified: now, changeFrequency: 'weekly' as const, priority: 0.8 })),
    { url: absoluteUrl('/about/'), lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: absoluteUrl('/privacy/'), lastModified: now, changeFrequency: 'monthly', priority: 0.2 },
    { url: absoluteUrl('/terms/'), lastModified: now, changeFrequency: 'monthly', priority: 0.2 },
    ...articles.map((article) => ({ url: absoluteUrl(`/article/${article.slug}/`), lastModified: new Date(article.date), changeFrequency: 'weekly' as const, priority: 0.8 })),
  ];
}
