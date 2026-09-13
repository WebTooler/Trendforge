import fs from 'node:fs';
import path from 'node:path';
import { copyrightSafetyGate, type ImageCandidate } from '../lib/copyright-safety';

const dir = 'content/articles';
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort() : [];
if (!files.length) {
  console.log('No articles found; asset validation skipped.');
  process.exit(0);
}

function field(text: string, key: string) {
  const match = text.match(new RegExp(`^${key}:\\s*"([\\s\\S]*?)"\\s*$`, 'm'));
  return match ? match[1].replace(/\\"/g, '"') : '';
}

let failed = false;
for (const file of files) {
  const raw = fs.readFileSync(path.join(dir, file), 'utf8');
  const parts = raw.split(/^---$/m);
  const front = parts[1] ?? '';
  const body = parts.slice(2).join('---').split(/^## Sources$/m)[0].trim();
  const image = field(front, 'image');
  const imageAlt = field(front, 'imageAlt');
  const imageSource = field(front, 'imageSource');
  const imageLicense = field(front, 'imageLicense');
  const slug = field(front, 'slug') || file.replace(/\.md$/, '');
  const localPath = image.startsWith('/Trendforge/') ? path.join('.', image.slice('/Trendforge/'.length)) : '';
  const candidate: ImageCandidate = { url: image, source: imageSource, license: imageLicense };
  const gate = copyrightSafetyGate({ content: body, sources: [...raw.matchAll(/\]\((https:\/\/[^)]+)\)/g)].map(m => m[1]), images: [candidate] }, { requireImages: true });
  const ok = Boolean(image && imageAlt && imageSource && imageLicense && localPath && fs.existsSync(localPath) && gate.checks.safeImages);
  console.log(`${ok ? 'PASS' : 'FAIL'} image gate: ${slug}`);
  if (!ok) failed = true;
}

if (failed) {
  console.error('One or more articles failed the image safety gate. Publication blocked.');
  process.exit(1);
}
console.log('All article images are present, article-specific, and have verified safety metadata.');
