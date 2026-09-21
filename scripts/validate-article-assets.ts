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
const manifestPath = 'data/image-manifest.json';
const imageManifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : { images: {} };
const manifestImages = imageManifest?.images && typeof imageManifest.images === 'object' ? imageManifest.images : {};
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
  const isFlux =
    imageSource === 'Cloudflare Workers AI — FLUX.1 Schnell' &&
    imageLicense === 'Model-generated' &&
    generator === 'Cloudflare FLUX.1 Schnell' &&
    image.endsWith('.1024x576.png');
  const isSvgFallback =
    imageSource === 'TrendForge original editorial visual' &&
    imageLicense === 'Original' &&
    generator === 'TrendForge SVG fallback' &&
    image.endsWith('.svg');
  const candidate: ImageCandidate = { url: image, source: imageSource, license: imageLicense };
  const gate = copyrightSafetyGate({ content: body, sources: [...raw.matchAll(/\]\((https:\/\/[^)]+)\)/g)].map(m => m[1]), images: [candidate] }, { requireImages: true });

  let visualOk = false;
  let duplicate = false;
  let relevanceOk = true;
  const manifestEntry = manifestImages?.[slug];
  if (manifestEntry) {
    const brief = manifestEntry.visualBrief;
    const anchors = Array.isArray(brief?.storyAnchors) ? brief.storyAnchors : [];
    const relevance = manifestEntry.relevance;
    const matchedCount = Array.isArray(relevance?.matchedAnchors) ? relevance.matchedAnchors.length : 0;
    const anchorMinimum = anchors.length >= 6 ? 1 : Math.min(2, anchors.length);
    const relaxedRelevant = Boolean(relevance && matchedCount >= anchorMinimum);
    relevanceOk = Boolean(brief && anchors.length > 0 && typeof manifestEntry.promptLength === 'number' && manifestEntry.promptLength <= 1900 && (relevance?.passed === true || relaxedRelevant));
  }
  if (localPath && fs.existsSync(localPath)) {
    const bytes = fs.readFileSync(localPath);
    const dims = pngDimensions(bytes);
    const isSvg = image.endsWith('.svg') && bytes.slice(0, 200).toString('utf8').includes('<svg');
    const hash = crypto.createHash('sha256').update(bytes).digest('hex');
    duplicate = hashes.has(hash);
    hashes.set(hash, slug);
    visualOk = isFlux
      ? Boolean(dims && dims.width === 1024 && dims.height === 576)
      : isSvg && bytes.length > 100;
  }

  const ok = Boolean(
    image && imageAlt && (isFlux || isSvgFallback) &&
    localPath && fs.existsSync(localPath) && gate.checks.safeImages && visualOk && relevanceOk && !duplicate
  );
  console.log(`${ok ? 'PASS' : 'FAIL'} image gate: ${slug}${isSvgFallback ? ' (SVG fallback)' : ''}${duplicate ? ' (duplicate visual)' : ''}${!relevanceOk ? ' (visual relevance contract failed)' : ''}`);
  if (!ok) failed = true;
}
if (failed) {
  console.error('One or more articles failed the FLUX image quality/safety gate. Publication blocked.');
  process.exit(1);
}
console.log(`All ${files.length} article images passed: FLUX.1 Schnell PNG or zero-quota SVG fallback, unique, present, and safety metadata verified.`);
