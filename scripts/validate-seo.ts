import { articles } from '../lib/articles';
import { absoluteUrl, categorySlug, seoDescription, seoTitle, siteName, siteUrl } from '../lib/seo';

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

  const title = seoTitle(article);
  const description = seoDescription(article);
  if (!article.title.trim()) fail(`${article.slug}: missing title.`);
  if (title.length < 10 || title.length > 70) fail(`${article.slug}: generated SEO title is ${title.length} chars; expected 10–70.`);
  if (!article.description.trim()) fail(`${article.slug}: missing source description.`);
  if (description.length < 50 || description.length > 170) fail(`${article.slug}: generated meta description is ${description.length} chars; expected 50–170.`);
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
