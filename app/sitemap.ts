import type { MetadataRoute } from 'next';
import { articles } from '@/lib/articles';

const base = 'https://webtooler.github.io/Trendforge';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const articleEntries = articles.map((article) => ({
    url: `${base}/article/${article.slug}`,
    lastModified: article.publishedAt ?? article.date,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  const categories = Array.from(new Set(articles.map((article) => article.category)))
    .map((category) => ({
      url: `${base}/category/${encodeURIComponent(category.toLowerCase().replace(/\s+/g, '-'))}`,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }));

  return [
    { url: base, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/about`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${base}/search`, changeFrequency: 'weekly', priority: 0.5 },
    ...categories,
    ...articleEntries,
  ];
}
