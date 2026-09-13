import fs from 'node:fs';
import path from 'node:path';

const articleDir = 'content/articles';
const publicDir = 'public/images/articles';
const manifestPath = 'data/image-manifest.json';

function field(text: string, key: string) {
  const match = text.match(new RegExp(`^${key}:\\s*"([\\s\\S]*?)"\\s*$`, 'm'));
  return match ? match[1].replace(/\\"/g, '"') : '';
}

function yamlEscape(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, ' ');
}

function xmlEscape(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90);
}

function keywords(title: string, description: string, category: string) {
  const stop = new Set(['the','and','for','with','from','what','this','that','into','about','after','your','will','how','why','are','was','has','have','its','their','industry','latest']);
  return [...new Set(`${title} ${description} ${category}`.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length >= 4 && !stop.has(w)))].slice(0, 5);
}

function makeSvg(title: string, description: string, category: string) {
  const safeTitle = xmlEscape(title);
  const safeCategory = xmlEscape(category.toUpperCase());
  const chips = keywords(title, description, category);
  const chipSvg = chips.map((word, i) => {
    const x = 90 + (i % 3) * 285;
    const y = 455 + Math.floor(i / 3) * 62;
    return `<g><rect x="${x}" y="${y}" width="250" height="42" rx="21" fill="#ffffff" fill-opacity="0.10"/><text x="${x + 125}" y="${y + 27}" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="18" font-weight="600" fill="#ffffff">${xmlEscape(word)}</text></g>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-labelledby="title desc">
  <title id="title">${safeTitle}</title>
  <desc id="desc">Original TrendForge editorial cover for ${safeTitle}, focused on ${safeCategory}.</desc>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b1020"/><stop offset="1" stop-color="#183b68"/></linearGradient>
    <radialGradient id="glow"><stop offset="0" stop-color="#67e8f9" stop-opacity="0.55"/><stop offset="1" stop-color="#67e8f9" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="1040" cy="90" r="310" fill="url(#glow)"/>
  <circle cx="1040" cy="90" r="180" fill="none" stroke="#ffffff" stroke-opacity="0.18" stroke-width="2"/>
  <circle cx="1040" cy="90" r="115" fill="none" stroke="#ffffff" stroke-opacity="0.14" stroke-width="2"/>
  <path d="M820 160 C930 105 1040 180 1125 120" fill="none" stroke="#67e8f9" stroke-opacity="0.55" stroke-width="5" stroke-linecap="round"/>
  <rect x="72" y="70" width="230" height="44" rx="22" fill="#67e8f9"/>
  <text x="187" y="99" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="20" font-weight="800" fill="#07111f">${safeCategory}</text>
  <text x="72" y="215" font-family="Inter,Arial,sans-serif" font-size="54" font-weight="800" fill="#ffffff">TrendForge</text>
  <text x="72" y="295" font-family="Inter,Arial,sans-serif" font-size="40" font-weight="700" fill="#ffffff">${safeTitle.slice(0, 62)}</text>
  ${title.length > 62 ? `<text x="72" y="345" font-family="Inter,Arial,sans-serif" font-size="40" font-weight="700" fill="#ffffff">${xmlEscape(title.slice(62, 124))}</text>` : ''}
  ${chipSvg}
  <text x="72" y="585" font-family="Inter,Arial,sans-serif" font-size="18" font-weight="600" fill="#cbd5e1">Original editorial visual • Generated from this article's topic metadata</text>
</svg>`;
}

function updateFrontmatter(raw: string, values: Record<string, string>) {
  const separator = raw.indexOf('---', 3);
  if (separator < 0) return raw;
  const front = raw.slice(3, separator).trim();
  const body = raw.slice(separator + 3);
  const lines = front.split(/\r?\n/).filter(Boolean);
  for (const [key, value] of Object.entries(values)) {
    const index = lines.findIndex(line => line.startsWith(`${key}:`));
    const line = `${key}: "${yamlEscape(value)}"`;
    if (index >= 0) lines[index] = line;
    else lines.push(line);
  }
  return `---\n${lines.join('\n')}\n---${body}`;
}

fs.mkdirSync(publicDir, { recursive: true });
fs.mkdirSync('data', { recursive: true });
const manifest: Record<string, unknown> = {};
const files = fs.existsSync(articleDir) ? fs.readdirSync(articleDir).filter(f => f.endsWith('.md')).sort() : [];

for (const file of files) {
  const full = path.join(articleDir, file);
  let raw = fs.readFileSync(full, 'utf8');
  const title = field(raw, 'title');
  const description = field(raw, 'description');
  const category = field(raw, 'category') || 'Technology';
  const slug = field(raw, 'slug') || slugify(title) || file.replace(/\.md$/, '');
  if (!title || !description) continue;

  const imageFile = `${slug}.svg`;
  const imagePath = path.join(publicDir, imageFile);
  if (!fs.existsSync(imagePath)) fs.writeFileSync(imagePath, makeSvg(title, description, category));

  const imageUrl = `/Trendforge/images/articles/${imageFile}`;
  const imageAlt = `${title} — TrendForge editorial image`;
  raw = updateFrontmatter(raw, {
    image: imageUrl,
    imageAlt,
    imageSource: 'TrendForge original editorial visual',
    imageLicense: 'Original',
    imageGeneratedBy: 'TrendForge topic renderer',
  });
  fs.writeFileSync(full, raw);

  manifest[slug] = {
    image: imageUrl,
    alt: imageAlt,
    source: 'TrendForge original editorial visual',
    license: 'Original',
    generatedBy: 'TrendForge topic renderer',
    relatedTo: { title, category, keywords: keywords(title, description, category) },
  };
}

fs.writeFileSync(manifestPath, JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), images: manifest }, null, 2) + '\n');
console.log(`Image pipeline complete: ${Object.keys(manifest).length} article image(s) verified.`);
