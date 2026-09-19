import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const articleDir = 'content/articles';
const publicDir = 'public/images/articles';
const manifestPath = 'data/image-manifest.json';
const MODEL = '@cf/black-forest-labs/flux-1-schnell';
const WIDTH = 1024;
const HEIGHT = 576;
const STEPS = 4;

function field(text: string, key: string) {
  const match = text.match(new RegExp(`^${key}:\\s*"([\\s\\S]*?)"\\s*$`, 'm'));
  return match ? match[1].replace(/\\\"/g, '"') : '';
}
function yamlEscape(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\\"').replace(/\r?\n/g, ' ');
}
function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90);
}
function updateFrontmatter(raw: string, values: Record<string, string>) {
  const separator = raw.indexOf('---', 3);
  if (separator < 0) throw new Error('invalid frontmatter');
  const front = raw.slice(3, separator).trim();
  const body = raw.slice(separator + 3);
  const lines = front.split(/\r?\n/).filter(Boolean);
  for (const [key, value] of Object.entries(values)) {
    const line = `${key}: "${yamlEscape(value)}"`;
    const index = lines.findIndex(x => x.startsWith(key + ':'));
    if (index >= 0) lines[index] = line;
    else lines.push(line);
  }
  return `---\n${lines.join('\n')}\n---${body}`;
}

const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
if (!account || !token) throw new Error('CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required');

fs.mkdirSync(publicDir, { recursive: true });
fs.mkdirSync('data', { recursive: true });

const allFiles = fs.existsSync(articleDir) ? fs.readdirSync(articleDir).filter(f => f.endsWith('.md')).sort() : [];
const status = await import('node:child_process').then(({ execFileSync }) => {
  try { return execFileSync('git', ['status', '--porcelain', '--untracked-files=all', '--', articleDir], { encoding: 'utf8' }); }
  catch { return ''; }
});
const files = status.split(/\r?\n/)
  .map(line => line.match(/^\?\?\s+(.+)$/)?.[1])
  .filter((file): file is string => typeof file === 'string')
  .filter(file => file.startsWith(articleDir + '/') && file.endsWith('.md'))
  .map(file => file.slice(articleDir.length + 1))
  .filter(file => allFiles.includes(file))
  .sort();
const manifest: Record<string, unknown> = {};
console.log(`FLUX image scope: ${files.length} newly generated article(s); existing published articles are intentionally excluded.`);
let generated = 0;
let skipped = 0;
let failures = 0;

for (const file of files) {
  const full = path.join(articleDir, file);
  let raw = fs.readFileSync(full, 'utf8');
  const title = field(raw, 'title');
  const description = field(raw, 'description');
  const category = field(raw, 'category') || 'Technology';
  const slug = field(raw, 'slug') || slugify(title) || file.replace(/\.md$/, '');
  if (!title || !description) continue;

  const outputFile = `${slug}.1024x576.png`;
  const outputPath = path.join(publicDir, outputFile);

  const { buildImagePrompt } = await import('./trendforge-visual-planner.mjs') as unknown as {
    buildImagePrompt: (input: { title: string; description: string; category: string; body: string }) => { brief: any; prompt: string };
  };
  const { brief, prompt } = buildImagePrompt({ title, description, category, body: raw });
  console.log(`Generating FLUX image for ${file}: ${brief.mode}; prompt=${prompt.length} chars`);

  try {
    const url = 'https://api.cloudflare.com/client/v4/accounts/' + account + '/ai/run/' + MODEL;
    const started = Date.now();
    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, steps: STEPS })
    });
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!response.ok) throw new Error('HTTP ' + response.status + ': ' + bytes.toString('utf8').slice(0, 500));

    const payload = JSON.parse(bytes.toString('utf8'));
    const encoded = payload?.result?.image || payload?.image;
    if (typeof encoded !== 'string' || !encoded.trim()) throw new Error('missing result.image');
    const base64 = encoded.includes(',') ? encoded.slice(encoded.indexOf(',') + 1) : encoded;
    const imageBytes = Buffer.from(base64, 'base64');
    const jpeg = imageBytes[0] === 0xff && imageBytes[1] === 0xd8 && imageBytes[2] === 0xff;
    const png = imageBytes[0] === 0x89 && imageBytes[1] === 0x50 && imageBytes[2] === 0x4e && imageBytes[3] === 0x47;
    if (!jpeg && !png) throw new Error('decoded payload is not JPEG/PNG');

    const normalized = await sharp(imageBytes)
      .resize({ width: WIDTH, height: HEIGHT, fit: 'cover', position: 'centre' })
      .png({ compressionLevel: 9, adaptiveFiltering: true, palette: false })
      .toBuffer();
    const meta = await sharp(normalized).metadata();
    if (meta.width !== WIDTH || meta.height !== HEIGHT) throw new Error(`normalized dimensions are ${meta.width}x${meta.height}`);

    fs.writeFileSync(outputPath, normalized);
    raw = updateFrontmatter(raw, {
      image: '/Trendforge/images/articles/' + outputFile,
      imageAlt: 'Editorial image for ' + title,
      imageSource: 'Cloudflare Workers AI — FLUX.1 Schnell',
      imageLicense: 'Model-generated',
      imageGeneratedBy: 'Cloudflare FLUX.1 Schnell'
    });
    fs.writeFileSync(full, raw);

    const elapsedMs = Date.now() - started;
    manifest[slug] = {
      status: 'generated', image: '/Trendforge/images/articles/' + outputFile,
      generatedBy: MODEL, width: WIDTH, height: HEIGHT, steps: STEPS,
      elapsedMs, bytes: normalized.length, visualBrief: brief, promptLength: prompt.length
    };
    generated++;
    console.log(`SUCCESS ${file}: ${WIDTH}x${HEIGHT}, ${normalized.length} bytes, ${elapsedMs}ms`);
  } catch (error) {
    failures++;
    manifest[slug] = { status: 'failed', error: String(error), generatedBy: MODEL, visualBrief: brief };
    console.error(`FAILED ${file}: ${String(error)}`);
  }
}

fs.writeFileSync(manifestPath, JSON.stringify({
  version: 3, generatedAt: new Date().toISOString(), model: MODEL,
  width: WIDTH, height: HEIGHT, steps: STEPS, generated, skipped, failed: failures, images: manifest
}, null, 2) + '\n');

console.log(`FLUX article image pipeline: generated=${generated}, existing=${skipped}, failed=${failures}, scopedToNewArticles=${files.length}`);
if (failures > 0) process.exit(1);
