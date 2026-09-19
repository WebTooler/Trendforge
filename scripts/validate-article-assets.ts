// TrendForge FLUX article image asset gate v4
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { copyrightSafetyGate, type ImageCandidate } from '../lib/copyright-safety';

const dir = 'content/articles';
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort() : [];
if (!files.length) { console.log('No articles found; asset validation skipped.'); process.exit(0); }

function field(text: string, key: string) {
  const match = text.match(new RegExp(`^${key}:\\s*"([\\s\\S]*?)"\\s*$`, 'm'));
  return match ? match[1].replace(/\\\"/g, '"') : '';
}
function pngDimensions(buffer: Buffer) {
  if (buffer.length < 24 || buffer[0] !== 0x89 || buffer[1] !== 0x50 || buffer[2] !== 0x4e || buffer[3] !== 0x47) return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

let failed = false;
const hashes = new Map<string, string>();
for (const file of files) {
  const raw = fs.readFileSync(path.join(dir, file), 'utf8');
  const front = raw.split(/^---$/m)[1] ?? '';
  const body = raw.split(/^---$/m).slice(2).join('---').split(/^## Sources$/m)[0].trim();
  const image = field(front, 'image');
  const imageAlt = field(front, 'imageAlt');
  const imageSource = field(front, 'imageSource');
  const imageLicense = field(front, 'imageLicense');
  const generator = field(front, 'imageGeneratedBy');
  const slug = field(front, 'slug') || file.replace(/\.md$/, '');
  const localPath = image.startsWith('/Trendforge/') ? path.join('public', image.slice('/Trendforge/'.length)) : '';
  const candidate: ImageCandidate = { url: image, source: imageSource, license: imageLicense };
  const gate = copyrightSafetyGate({ content: body, sources: [...raw.matchAll(/\]\((https:\/\/[^)]+)\)/g)].map(m => m[1]), images: [candidate] }, { requireImages: true });

  let visualOk = false;
  let duplicate = false;
  if (localPath && fs.existsSync(localPath)) {
    const bytes = fs.readFileSync(localPath);
    const dims = pngDimensions(bytes);
    const hash = crypto.createHash('sha256').update(bytes).digest('hex');
    duplicate = hashes.has(hash);
    hashes.set(hash, slug);
    visualOk = Boolean(dims && dims.width === 1024 && dims.height === 576);
  }

  const ok = Boolean(
    image && imageAlt && imageSource === 'Cloudflare Workers AI — FLUX.1 Schnell' &&
    imageLicense === 'Model-generated' &&
    generator === 'Cloudflare FLUX.1 Schnell' &&
    localPath && fs.existsSync(localPath) && gate.checks.safeImages && visualOk && !duplicate
  );
  console.log(`${ok ? 'PASS' : 'FAIL'} FLUX image gate: ${slug}${duplicate ? ' (duplicate visual)' : ''}`);
  if (!ok) failed = true;
}
if (failed) {
  console.error('One or more articles failed the FLUX image quality/safety gate. Publication blocked.');
  process.exit(1);
}
console.log(`All ${files.length} article images passed: FLUX.1 Schnell, 1024x576 PNG, unique, present, and safety metadata verified.`);
