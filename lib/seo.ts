import type { Metadata } from 'next';
import type { Article } from './articles';

export const siteUrl = 'https://webtooler.github.io/Trendforge';
export const siteName = 'TrendForge';
export const siteTitle = 'TrendForge — What Matters, Explained';
export const defaultDescription = 'Smart, useful stories about AI, technology, digital life and how-to guides.';

export function absoluteUrl(path: string) {
  return `${siteUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

export function categorySlug(category: string) {
  return category.toLowerCase().trim().replace(/\s+/g, '-');
}

export function seoTitle(article: Article) {
  const title = article.title.trim();
  if (title.length <= 70) return title;
  const beforeDash = title.split(/\s+[—–-]\s+/)[0]?.trim();
  if (beforeDash && beforeDash.length >= 30 && beforeDash.length <= 70) return beforeDash;
  return `${title.slice(0, 67).trimEnd()}…`;
}

export function seoDescription(article: Article) {
  const text = article.description.replace(/\s+/g, ' ').trim();
  if (text.length <= 170) return text;
  const firstSentence = text.match(/^.{50,170}?[.!?](?:\s|$)/)?.[0]?.trim();
  if (firstSentence && firstSentence.length >= 50) return firstSentence;
  return `${text.slice(0, 167).trimEnd()}…`;
}

const indexRobots = {
  index: true,
  follow: true,
  'max-image-preview': 'large' as const,
  'max-snippet': -1,
  'max-video-preview': -1,
};

export function siteMetadata(): Metadata {
  return {
    metadataBase: new URL(`${siteUrl}/`),
    title: { default: siteTitle, template: '%s | TrendForge' },
    description: defaultDescription,
    alternates: { canonical: '/', types: { 'application/rss+xml': `${siteUrl}/feed.xml` } },
    openGraph: { type: 'website', siteName, title: siteTitle, description: defaultDescription, url: `${siteUrl}/` },
    twitter: { card: 'summary_large_image', title: siteTitle, description: defaultDescription },
    robots: indexRobots,
    referrer: 'origin-when-cross-origin',
  };
}

export function articleMetadata(article: Article): Metadata {
  const title = seoTitle(article);
  const description = seoDescription(article);
  const url = absoluteUrl(`/article/${article.slug}/`);
  const image = article.image ? absoluteUrl(article.image) : undefined;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article', title, description, url, siteName,
      publishedTime: article.date, modifiedTime: article.date, section: article.category,
      ...(image ? { images: [{ url: image, alt: article.imageAlt || article.title, width: 1200, height: 630 }] } : {}),
    },
    twitter: { card: image ? 'summary_large_image' : 'summary', title, description, ...(image ? { images: [image] } : {}) },
    robots: indexRobots,
    referrer: 'origin-when-cross-origin',
  };
}

export function categoryMetadata(category: string): Metadata {
  const title = category.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const url = absoluteUrl(`/category/${categorySlug(category)}/`);
  const description = `Useful ${title.toLowerCase()} stories and explainers from TrendForge.`;
  return {
    title: `${title} — TrendForge`, description, alternates: { canonical: url },
    openGraph: { type: 'website', title: `${title} — TrendForge`, description, url, siteName },
    twitter: { card: 'summary_large_image', title: `${title} — TrendForge`, description },
    robots: indexRobots,
  };
}

export function articleJsonLd(article: Article) {
  const url = absoluteUrl(`/article/${article.slug}/`);
  const image = article.image ? absoluteUrl(article.image) : undefined;
  return {
    '@context': 'https://schema.org', '@type': 'Article',
    headline: article.title, description: seoDescription(article), url,
    datePublished: article.date, dateModified: article.date, articleSection: article.category,
    author: { '@type': 'Organization', name: siteName, url: `${siteUrl}/` },
    publisher: { '@type': 'Organization', name: siteName, url: `${siteUrl}/` },
    ...(image ? { image: [image] } : {}),
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
  };
}

export function websiteJsonLd() {
  return {
    '@context': 'https://schema.org', '@type': 'WebSite', name: siteName,
    url: `${siteUrl}/`, description: defaultDescription,
    publisher: { '@type': 'Organization', name: siteName, url: `${siteUrl}/` },
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: absoluteUrl(item.path) })),
  };
}

export function safeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}
