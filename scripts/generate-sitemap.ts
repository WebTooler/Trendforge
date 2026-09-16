import { mkdir, writeFile } from 'node:fs/promises';
import { articles } from '../lib/articles';
import { TREND_FORGE_CATEGORIES, categorySlug } from '../lib/categories';

const siteUrl = 'https://webtooler.github.io/Trendforge';

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function urlEntry(url: string, lastModified: string, changeFrequency: string, priority: string) {
  return [
    '  <url>',
    `    <loc>${escapeXml(url)}</loc>`,
    `    <lastmod>${lastModified}</lastmod>`,
    `    <changefreq>${changeFrequency}</changefreq>`,
    `    <priority>${priority}</priority>`,
    '  </url>',
  ].join('\n');
}

const today = new Date().toISOString().slice(0, 10);
const categorySlugs = [...new Set(TREND_FORGE_CATEGORIES.map(categorySlug))];
const urls = [
  urlEntry(`${siteUrl}/`, today, 'daily', '1.0'),
  urlEntry(`${siteUrl}/search/`, today, 'weekly', '0.6'),
  urlEntry(`${siteUrl}/subscribe/`, today, 'weekly', '0.6'),
  ...categorySlugs.map((category) => urlEntry(`${siteUrl}/category/${category}/`, today, 'weekly', '0.8')),
  urlEntry(`${siteUrl}/about/`, today, 'monthly', '0.4'),
  urlEntry(`${siteUrl}/privacy/`, today, 'monthly', '0.2'),
  urlEntry(`${siteUrl}/terms/`, today, 'monthly', '0.2'),
  ...articles.map((article) => urlEntry(
    `${siteUrl}/article/${article.slug}/`,
    article.date,
    'weekly',
    '0.8',
  )),
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;

await mkdir('public', { recursive: true });
await writeFile('public/sitemap.xml', xml, 'utf8');
console.log(`Sitemap generated: ${urls.length} URLs -> public/sitemap.xml`);
