import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const articleDir = 'content/articles';
const imageDir = 'public/images/articles';
const minBytes = 20_000;
const expectedWidth = 1024;
const expectedHeight = 576;

function field(text: string, key: string) {
  const m = text.match(new RegExp(`^${key}:\\s*"([\\s\\S]*?)"\\s*$`, 'm'));
  return m ? m[1].replace(/\\"/g, '"') : '';
}

function jpegSize(file: string) {
  const b = fs.readFileSync(file);
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
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
    if (sof && i + 7 < b.length) return { width: b.readUInt16BE(i + 5), height: b.readUInt16BE(i + 3), bytes: b.length };
    i += len;
  }
  return null;
}

function ocrWords(file: string) {
  if (!spawnSync('tesseract', ['--version'], { stdio: 'ignore' }).status === 0) return [];
  const out = spawnSync('tesseract', [file, 'stdout', '--psm', '11', 'tsv'], { encoding: 'utf8' });
  if (out.status !== 0) return [];
  return out.stdout.split(/\\r?\\n/).slice(1).map(line => line.split('\\t')).filter(row => row.length >= 12).map(row => ({ text: row[11]?.trim() || '', confidence: Number(row[10]) || 0 })).filter(x => /[A-Za-z]{3,}/.test(x.text) && x.confidence >= 55);
}

const files = fs.existsSync(articleDir) ? fs.readdirSync(articleDir).filter(f => f.endsWith('.md')).sort() : [];
const failures: string[] = [];
const warnings: string[] = [];
const hashes = new Map<string, string>();
const report: Record<string, unknown>[] = [];

for (const file of files) {
  const raw = fs.readFileSync(path.join(articleDir, file), 'utf8');
  const front = raw.split(/^---$/m)[1] ?? '';
  const slug = field(front, 'slug') || file.replace(/\\.md$/, '');
  const image = field(front, 'image');
  const generator = field(front, 'imageGeneratedBy');
  if (generator !== 'TrendForge Image V3 — Cloudflare FLUX.2 Klein 9B') continue;

  const local = image.startsWith('/Trendforge/') ? path.join('public', image.slice('/Trendforge/'.length)) : '';
  const item: Record<string, unknown> = { slug, image, checks: {} };
  const checks = item.checks as Record<string, unknown>;
  if (!local || !fs.existsSync(local)) {
    failures.push(`${slug}: missing local V3 image`);
    checks.presence = false;
    report.push(item);
    continue;
  }

  const info = jpegSize(local);
  checks.presence = true;
  checks.format = info?.bytes && info.bytes >= minBytes ? 'jpeg' : false;
  checks.dimensions = info ? `${info.width}x${info.height}` : false;
  checks.ocr = 'not-run';

  const hash = crypto.createHash('sha256').update(fs.readFileSync(local)).digest('hex');
  if (hashes.has(hash)) failures.push(`${slug}: exact duplicate of ${hashes.get(hash)}`);
  hashes.set(hash, slug);

  if (!info || info.width !== expectedWidth || info.height !== expectedHeight || info.bytes < minBytes) {
    failures.push(`${slug}: invalid V3 raster format/dimensions/size`);
  }

  const words = ocrWords(local);
  checks.ocr = words.length ? { status: 'FAIL', words } : { status: 'PASS', words: [] };
  if (words.length) failures.push(`${slug}: OCR detected readable text-like content: ${words.map(x => x.text).join(', ')}`);

  report.push(item);
}

const output = { version: 1, generatedAt: new Date().toISOString(), policy: { textPolicy: 'readable text is a hard fail', dimensions: '1024x576', minimumBytes: minBytes, duplicatePolicy: 'exact SHA-256 duplicates are a hard fail', semanticPolicy: 'story relevance, fake logos, and composition require a vision-capable QA provider before production integration' }, failures, warnings, candidates: report };
fs.mkdirSync('data/image-v3-test', { recursive: true });
fs.writeFileSync('data/image-v3-test/visual-qa.json', JSON.stringify(output, null, 2) + '\n');

console.log(JSON.stringify(output, null, 2));
if (failures.length) process.exit(1);
console.log('Image V3 visual QA technical gate passed. Production integration remains blocked until vision QA is enabled and passes.');
