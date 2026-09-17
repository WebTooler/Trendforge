// TrendForge asset-gate validation marker v4
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { copyrightSafetyGate, type ImageCandidate } from '../lib/copyright-safety';

const dir = 'content/articles';
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort() : [];
if (!files.length) { console.log('No articles found; asset validation skipped.'); process.exit(0); }

function field(text: string, key: string) {
  const match = text.match(new RegExp(`^${key}:\\s*"([\\s\\S]*?)"\\s*$`, 'm'));
  return match ? match[1].replace(/\\"/g, '"') : '';
}

function rasterInfo(file: string) {
  const b = fs.readFileSync(file);
  if (b.length >= 24 && b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) {
    return { type: 'png', width: b.readUInt32BE(16), height: b.readUInt32BE(20), bytes: b.length };
  }
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1];
      i += 2;
      if (marker === 0xd8 || marker === 0xd9) continue;
      if (i + 2 > b.length) break;
      const len = b.readUInt16BE(i);
      if (len < 2 || i + len > b.length) break;
      const sof = [0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker);
      if (sof && i + 7 < b.length) return { type: 'jpeg', height: b.readUInt16BE(i + 3), width: b.readUInt16BE(i + 5), bytes: b.length };
      i += len;
    }
  }
  return null;
}

let failed = false;
const hashes = new Map<string, string>();

for (const file of files) {
  const raw = fs.readFileSync(path.join(dir, file), 'utf8');
  const parts = raw.split(/^---$/m);
  const front = parts[1] ?? '';
  const body = parts.slice(2).join('---').split(/^## Sources$/m)[0].trim();
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
  let reason = '';

  if (localPath && fs.existsSync(localPath)) {
    const bytes = fs.readFileSync(localPath);
    const hash = crypto.createHash('sha256').update(bytes).digest('hex');
    duplicate = hashes.has(hash);
    hashes.set(hash, slug);

    if (generator === 'TrendForge topic illustration engine v2' && localPath.endsWith('.svg')) {
      const svg = bytes.toString('utf8');
      const visibleText = (svg.match(/<text\\b/gi) || []).length;
      const hasMetadata = /<title\\b[^>]*>/.test(svg) && /<desc\\b[^>]*>/.test(svg);
      visualOk = svg.includes('viewBox="0 0 1200 630"') && visibleText === 0 && hasMetadata;
      if (!visualOk) reason = 'invalid v2 SVG';
    } else if (generator === 'TrendForge Image V3 — Cloudflare FLUX.2 Klein 9B' && /\\.(jpe?g|png)$/i.test(localPath)) {
      const info = rasterInfo(localPath);
      visualOk = Boolean(info && info.width === 1024 && info.height === 576 && info.bytes >= 20_000);
      if (!visualOk) reason = info ? `invalid V3 raster ${info.type} ${info.width}x${info.height} ${info.bytes}B` : 'invalid raster signature';
    } else {
      reason = 'unsupported generator/format combination';
    }
  } else {
    reason = 'missing local image';
  }

  const metadataOk = Boolean(image && imageAlt && imageSource && imageLicense);
  const ok = metadataOk && Boolean(localPath && fs.existsSync(localPath)) && gate.checks.safeImages && visualOk && !duplicate;
  console.log(`${ok ? 'PASS' : 'FAIL'} image gate: ${slug}${duplicate ? ' (duplicate visual)' : ''}${reason ? ` (${reason})` : ''}`);
  if (!ok) failed = true;
}

if (failed) {
  console.error('One or more articles failed the image quality/safety gate. Publication blocked.');
  process.exit(1);
}
console.log(`All ${files.length} article images passed: format, dimensions, uniqueness, presence, metadata, and copyright-safety checks verified.`);
