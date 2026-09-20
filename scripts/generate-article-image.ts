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

function xmlEscape(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function fallbackFamily(title: string, description: string, category: string) {
  const t = `${title} ${description} ${category}`.toLowerCase();
  if (/\b(bitcoin|ethereum|crypto|blockchain|token|defi)\b/.test(t)) return 'crypto';
  if (/\b(cyber|security|malware|vulnerability|exploit|attack)\b/.test(t)) return 'cyber';
  if (/\b(ai|artificial intelligence|model|robot)\b/.test(t)) return 'ai';
  if (/\b(product|device|phone|laptop|chip|launch|release)\b/.test(t)) return 'product';
  if (/\b(regulation|regulatory|policy|government|lawmakers|oversight)\b/.test(t)) return 'governance';
  return 'technology';
}
function makeSvgFallback(title: string, description: string, category: string) {
  const family = fallbackFamily(title, description, category);
  const palette: Record<string, [string, string, string]> = {
    crypto: ['#17120a', '#f59e0b', '#fff7ed'],
    cyber: ['#071b18', '#34d399', '#ecfdf5'],
    ai: ['#081a2e', '#38bdf8', '#f8fafc'],
    product: ['#1a1022', '#e879f9', '#fff7ed'],
    governance: ['#071a2b', '#2dd4bf', '#f8fafc'],
    technology: ['#0b1520', '#818cf8', '#f8fafc']
  };
  const [bg, accent, light] = palette[family] || palette.technology;
  const safeTitle = xmlEscape(title);
  const safeDescription = xmlEscape(description);
  const shapes = family === 'crypto'
    ? `<circle cx="850" cy="315" r="145" fill="${accent}" fill-opacity=".12" stroke="${accent}" stroke-width="8"/><path d="M850 205l55 70v80l-55 70-55-70v-80z" fill="${light}" fill-opacity=".12" stroke="${light}" stroke-width="6"/><path d="M620 315h460M850 145v340" stroke="${accent}" stroke-opacity=".28" stroke-width="5"/>`
    : family === 'cyber'
    ? `<rect x="680" y="120" width="110" height="390" rx="12" fill="${light}" fill-opacity=".06" stroke="${accent}" stroke-width="6"/><rect x="820" y="120" width="110" height="390" rx="12" fill="${light}" fill-opacity=".06" stroke="${accent}" stroke-width="6"/><rect x="960" y="120" width="110" height="390" rx="12" fill="${light}" fill-opacity=".06" stroke="${accent}" stroke-width="6"/><path d="M705 190h60m80 0h60m80 0h60M705 270h60m80 0h60m80 0h60M705 350h60m80 0h60m80 0h60" stroke="${accent}" stroke-width="8" stroke-linecap="round"/>`
    : family === 'product'
    ? `<ellipse cx="850" cy="510" rx="270" ry="34" fill="${accent}" opacity=".16"/><rect x="620" y="160" width="460" height="300" rx="34" fill="${light}" fill-opacity=".06" stroke="${accent}" stroke-width="8"/><rect x="665" y="205" width="370" height="210" rx="18" fill="${bg}" stroke="${light}" stroke-opacity=".5" stroke-width="4"/>`
    : family === 'ai'
    ? `<path d="M700 310h300M850 160v300M745 205l210 210M955 205L745 415" stroke="${accent}" stroke-opacity=".5" stroke-width="5"/><circle cx="850" cy="310" r="120" fill="${accent}" fill-opacity=".1" stroke="${accent}" stroke-width="8"/><circle cx="850" cy="310" r="32" fill="${light}" fill-opacity=".5"/>`
    : `<rect x="650" y="155" width="420" height="300" rx="28" fill="${light}" fill-opacity=".05" stroke="${accent}" stroke-width="8"/><path d="M700 235h320M700 315h240M700 395h290" stroke="${accent}" stroke-opacity=".65" stroke-width="10" stroke-linecap="round"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-labelledby="title desc"><title id="title">${safeTitle}</title><desc id="desc">Original TrendForge ${family} fallback illustration. ${safeDescription}</desc><rect width="1200" height="630" fill="${bg}"/><circle cx="1030" cy="80" r="260" fill="${accent}" opacity=".07"/><circle cx="160" cy="560" r="220" fill="${accent}" opacity=".05"/>${shapes}<path d="M0 575H1200" stroke="${accent}" stroke-opacity=".25" stroke-width="3"/></svg>`;
}

const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
const cloudflareAvailable = Boolean(account && token);

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
    if (!cloudflareAvailable) throw new Error('Cloudflare AI credentials unavailable');
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
    const reason = String(error);
    try {
      const fallbackFile = `${slug}.svg`;
      const fallbackPath = path.join(publicDir, fallbackFile);
      fs.writeFileSync(fallbackPath, makeSvgFallback(title, description, category));
      raw = updateFrontmatter(raw, {
        image: '/Trendforge/images/articles/' + fallbackFile,
        imageAlt: 'Original TrendForge fallback illustration for ' + title,
        imageSource: 'TrendForge original editorial visual',
        imageLicense: 'Original',
        imageGeneratedBy: 'TrendForge SVG fallback'
      });
      fs.writeFileSync(full, raw);
      manifest[slug] = {
        status: 'fallback', image: '/Trendforge/images/articles/' + fallbackFile,
        generatedBy: 'TrendForge SVG fallback', fallbackFrom: MODEL,
        fallbackReason: reason, width: 1200, height: 630, visualBrief: brief
      };
      console.warn(`FLUX unavailable for ${file}; using zero-quota SVG fallback: ${reason}`);
      skipped++;
    } catch (fallbackError) {
      failures++;
      manifest[slug] = { status: 'failed', error: reason, fallbackError: String(fallbackError), generatedBy: MODEL, visualBrief: brief };
      console.error(`FAILED ${file}: FLUX and SVG fallback both failed: ${reason}; fallback=${String(fallbackError)}`);
    }
  }
}

fs.writeFileSync(manifestPath, JSON.stringify({
  version: 3, generatedAt: new Date().toISOString(), model: MODEL,
  width: WIDTH, height: HEIGHT, steps: STEPS, generated, skipped, failed: failures, images: manifest
}, null, 2) + '\n');

console.log(`FLUX article image pipeline: generated=${generated}, svgFallback=${skipped}, failed=${failures}, scopedToNewArticles=${files.length}`);
if (failures > 0) process.exit(1);
