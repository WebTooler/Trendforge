import { mkdir, readFile, writeFile } from 'node:fs/promises';
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

function validDate(value: string) {
  return /^\\d{4}-\\d{2}-\\d{2}(?:T.*)?$/.test(value);
}

function entry(url: string, lastModified: string, frequency: string, priority: string) {
  if (!validDate(lastModified)) {
    throw new Error(`Invalid sitemap lastmod for ${url}: ${lastModified}`);
  }
  return [
    '  <url>',
    `    <loc>${escapeXml(url)}</loc>`,
    `    <lastmod>${escapeXml(lastModified)}</lastmod>`,
    `    <changefreq>${frequency}</changefreq>`,
    `    <priority>${priority}</priority>`,
    '  </url>',
  ].join('\\n');
}

const today = new Date().toISOString().slice(0, 10);
const categories = [...new Set(TREND_FORGE_CATEGORIES.map(categorySlug))];

const urls = [
  entry(`${siteUrl}/`, today, 'daily', '1.0'),
  entry(`${siteUrl}/search/`, today, 'weekly', '0.6'),
  entry(`${siteUrl}/subscribe/`, today, 'weekly', '0.6'),
  ...categories.map((slug) => entry(`${siteUrl}/category/${slug}/`, today, 'weekly', '0.8')),
  entry(`${siteUrl}/about/`, today, 'monthly', '0.4'),
  entry(`${siteUrl}/privacy/`, today, 'monthly', '0.2'),
  entry(`${siteUrl}/terms/`, today, 'monthly', '0.2'),
  ...articles.map((article) =>
    entry(`${siteUrl}/article/${article.slug}/`, article.date, 'weekly', '0.8'),
  ),
];

const locs = urls.map((item) => item.match(/<loc>(.*?)<\\/loc>/)?.[1]).filter(Boolean);
if (new Set(locs).size !== locs.length) {
  throw new Error('Duplicate URL detected in sitemap.');
}
if (locs.some((url) => !url!.startsWith(`${siteUrl}/`))) {
  throw new Error('Sitemap contains a URL outside the canonical GitHub Pages site.');
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\\n${urls.join('\\n')}\\n</urlset>\\n`;
const robots = `User-agent: *\\nAllow: /\\n\\nSitemap: ${siteUrl}/sitemap.xml\\n`;

await mkdir('out', { recursive: true });
await writeFile('out/sitemap.xml', sitemap, 'utf8');
await writeFile('out/robots.txt', robots, 'utf8');

const writtenSitemap = await readFile('out/sitemap.xml', 'utf8');
const writtenRobots = await readFile('out/robots.txt', 'utf8');

if (!writtenSitemap.startsWith('<?xml version="1.0" encoding="UTF-8"?>')) {
  throw new Error('Generated sitemap is missing XML declaration.');
}
if (!writtenSitemap.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')) {
  throw new Error('Generated sitemap is missing the sitemap namespace.');
}
if (!writtenSitemap.includes('<loc>https://webtooler.github.io/Trendforge/</loc>')) {
  throw new Error('Generated sitemap is missing the canonical homepage.');
}
if (!writtenRobots.includes(`Sitemap: ${siteUrl}/sitemap.xml`)) {
  throw new Error('robots.txt does not point to the canonical sitemap.');
}

console.log(`GitHub Pages SEO artifacts written and validated: ${locs.length} sitemap URLs, sitemap.xml, robots.txt`);
