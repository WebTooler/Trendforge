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

export function siteMetadata(): Metadata {
  return {
    metadataBase: new URL(siteUrl),
    title: { default: siteTitle, template: '%s | TrendForge' },
    description: defaultDescription,
    alternates: { canonical: '/', types: { 'application/rss+xml': `${siteUrl}/feed.xml` } },
    openGraph: { type: 'website', siteName, title: siteTitle, description: defaultDescription, url: siteUrl },
    twitter: { card: 'summary', title: siteTitle, description: defaultDescription },
    robots: { index: true, follow: true },
  };
}

export function articleMetadata(article: Article): Metadata {
  const url = absoluteUrl(`/article/${article.slug}/`);
  const image = article.image ? absoluteUrl(article.image) : undefined;
  return {
    title: article.title,
    description: article.description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article', title: article.title, description: article.description, url, siteName,
      publishedTime: article.date, section: article.category,
      ...(image ? { images: [{ url: image, alt: article.imageAlt || article.title }] } : {}),
    },
    twitter: { card: image ? 'summary_large_image' : 'summary', title: article.title, description: article.description, ...(image ? { images: [image] } : {}) },
    robots: { index: true, follow: true },
  };
}

export function categoryMetadata(category: string): Metadata {
  const title = category.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const url = absoluteUrl(`/category/${categorySlug(category)}/`);
  const description = `Useful ${title.toLowerCase()} stories and explainers from TrendForge.`;
  return {
    title: `${title} — TrendForge`, description, alternates: { canonical: url },
    openGraph: { type: 'website', title: `${title} — TrendForge`, description, url, siteName },
    twitter: { card: 'summary', title: `${title} — TrendForge`, description },
    robots: { index: true, follow: true },
  };
}

export function articleJsonLd(article: Article) {
  const url = absoluteUrl(`/article/${article.slug}/`);
  const image = article.image ? absoluteUrl(article.image) : undefined;
  return {
    '@context': 'https://schema.org', '@type': 'Article', headline: article.title, description: article.description,
    url, datePublished: article.date, dateModified: article.date, articleSection: article.category,
    author: { '@type': 'Organization', name: siteName, url: siteUrl },
    publisher: { '@type': 'Organization', name: siteName, url: siteUrl },
    ...(image ? { image: [image] } : {}), mainEntityOfPage: { '@type': 'WebPage', '@id': url },
  };
}

export function websiteJsonLd() {
  return {
    '@context': 'https://schema.org', '@type': 'WebSite', name: siteName, url: `${siteUrl}/`, description: defaultDescription,
    publisher: { '@type': 'Organization', name: siteName, url: siteUrl },
  };
}

export function safeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}
