import { articles } from '../lib/articles';
import { absoluteUrl, categorySlug, siteName, siteUrl } from '../lib/seo';

const errors: string[] = [];
const seenSlugs = new Set<string>();
const seenUrls = new Set<string>();

function fail(message: string) { errors.push(message); }

if (!siteUrl.startsWith('https://')) fail('SEO siteUrl must use HTTPS.');
if (!siteName.trim()) fail('SEO siteName is empty.');

for (const article of articles) {
  if (!article.slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(article.slug)) fail(`Invalid slug: ${article.slug}`);
  if (seenSlugs.has(article.slug)) fail(`Duplicate slug: ${article.slug}`);
  seenSlugs.add(article.slug);

  const canonical = absoluteUrl(`/article/${article.slug}/`);
  if (seenUrls.has(canonical)) fail(`Duplicate canonical URL: ${canonical}`);
  seenUrls.add(canonical);

  if (!article.title.trim()) fail(`${article.slug}: missing title.`);
  if (article.title.length > 70) fail(`${article.slug}: SEO title is ${article.title.length} chars; keep it <= 70.`);
  if (!article.description.trim()) fail(`${article.slug}: missing meta description.`);
  if (article.description.length < 50 || article.description.length > 170) fail(`${article.slug}: meta description should be 50–170 chars; got ${article.description.length}.`);
  if (!article.category.trim()) fail(`${article.slug}: missing category.`);
  if (categorySlug(article.category) !== article.category.toLowerCase().trim().replace(/\s+/g, '-')) fail(`${article.slug}: category slug normalization mismatch.`);

  if (!article.image?.startsWith('/Trendforge/images/articles/')) fail(`${article.slug}: image must be a local /Trendforge/images/articles/ asset.`);
  if (!article.imageAlt.trim()) fail(`${article.slug}: missing image alt text.`);
  if (!article.imageSource.trim()) fail(`${article.slug}: missing image source metadata.`);
  if (!article.imageLicense.trim()) fail(`${article.slug}: missing image license metadata.`);
  if (!article.imageGeneratedBy.trim() && article.imageLicense === 'Original') fail(`${article.slug}: original image is missing imageGeneratedBy.`);
}

if (errors.length) {
  console.error(`SEO validation FAILED with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`SEO validation PASS: ${articles.length} article(s), ${seenUrls.size} canonical URL(s).`);
