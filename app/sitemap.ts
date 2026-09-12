import type { MetadataRoute } from 'next';
import { articles } from '@/lib/articles';

const base = 'https://webtooler.github.io/Trendforge';

export default function sitemap(): MetadataRoute.Sitemap {
  const categories = [...new Set(articles.map((article) => article.category.toLowerCase().replace(/\s+/g, '-')))];

  return [
    { url: `${base}/`, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${base}/subscribe/`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.6 },
    ...categories.map((category) => ({
      url: `${base}/category/${category}/`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    { url: `${base}/about/`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
    { url: `${base}/privacy/`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.2 },
    { url: `${base}/terms/`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.2 },
    ...articles.map((article) => ({
      url: `${base}/article/${article.slug}/`,
      lastModified: new Date(article.date),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ];
}
