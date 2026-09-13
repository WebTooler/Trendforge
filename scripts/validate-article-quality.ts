import fs from 'node:fs';
import path from 'node:path';

const dir = 'content/articles';
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort() : [];
if (!files.length) {
  console.log('No articles found; content quality validation skipped.');
  process.exit(0);
}

const errors: string[] = [];
const seenSlugs = new Set<string>();
const seenTitles = new Set<string>();

function field(text: string, key: string) {
  const match = text.match(new RegExp(`^${key}:\\s*"([\\s\\S]*?)"\\s*$`, 'm'));
  return match ? match[1].replace(/\\"/g, '"') : '';
}

function normalize(text: string) {
  return text.toLowerCase().replace(/[`*_#>\[\]().,!?;:'"—–-]/g, ' ').replace(/\s+/g, ' ').trim();
}

for (const file of files) {
  const raw = fs.readFileSync(path.join(dir, file), 'utf8');
  const parts = raw.split(/^---$/m);
  if (parts.length < 3) {
    errors.push(`${file}: invalid frontmatter structure.`);
    continue;
  }
  const front = parts[1];
  const body = parts.slice(2).join('---').trim();
  const main = body.split(/^## Sources$/m)[0].trim();
  const title = field(front, 'title');
  const description = field(front, 'description');
  const slug = field(front, 'slug') || file.replace(/\.md$/, '');
  const category = field(front, 'category');
  const words = main.split(/\s+/).filter(Boolean).length;
  const headings = (main.match(/^##\s+.+$/gm) || []).length;
  const paragraphs = main
    .split(/\n\s*\n/)
    .map((block) => block.replace(/^##\s+.+\n?/, '').trim())
    .filter((p) => p && !/^\d+\.\s+/.test(p));
  const sourceUrls = [...raw.matchAll(/\]\((https:\/\/[^)]+)\)/g)].map((m) => m[1]);
  const unsafe = /<script\b|<iframe\b|javascript\s*:/i.test(raw);

  if (!title || title.length < 20 || title.length > 110) errors.push(`${slug}: title quality/length check failed.`);
  if (!description || description.length < 80 || description.length > 320) errors.push(`${slug}: description quality/length check failed.`);
  if (!category.trim()) errors.push(`${slug}: missing category.`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) errors.push(`${slug}: invalid slug.`);
  if (seenSlugs.has(slug)) errors.push(`${slug}: duplicate slug.`); else seenSlugs.add(slug);
  const titleKey = normalize(title);
  if (seenTitles.has(titleKey)) errors.push(`${slug}: duplicate title.`); else seenTitles.add(titleKey);
  if (words < 150) errors.push(`${slug}: article is too short (${words} words; minimum 150).`);
  if (headings < 3) errors.push(`${slug}: needs at least 3 H2 sections (found ${headings}).`);
  if (paragraphs.length < 4) errors.push(`${slug}: needs at least 4 substantive paragraphs.`);
  if (sourceUrls.length < 2 || sourceUrls.some((url) => !url.startsWith('https://'))) errors.push(`${slug}: needs at least 2 HTTPS source links.`);
  if (unsafe) errors.push(`${slug}: unsafe HTML/script content detected.`);

  const normalizedParagraphs = paragraphs.map(normalize).filter((p) => p.length >= 80);
  const duplicateParagraph = normalizedParagraphs.some((p, i) => normalizedParagraphs.indexOf(p) !== i);
  if (duplicateParagraph) errors.push(`${slug}: duplicate substantive paragraph detected.`);

  const genericFailure = /^(click here|read more|lorem ipsum|test article)\.?$/i.test(main.trim());
  if (genericFailure) errors.push(`${slug}: generic/placeholder content detected.`);

  console.log(`QUALITY ${errors.some((e) => e.startsWith(`${slug}:`)) ? 'FAIL' : 'PASS'}: ${slug} (${words} words, ${headings} H2s, ${sourceUrls.length} sources)`);
}

if (errors.length) {
  console.error(`\nContent quality validation FAILED with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`\nContent quality validation PASS: ${files.length} article(s) checked.`);
