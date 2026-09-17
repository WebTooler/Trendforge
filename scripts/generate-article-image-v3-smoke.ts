import fs from 'node:fs';
import path from 'node:path';

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;
const model = process.env.CLOUDFLARE_IMAGE_MODEL || '@cf/black-forest-labs/flux-2-klein-9b';
const manifestPath = 'data/image-manifest.json';
const outputDir = 'data/image-v3-test';
const testLimit = Number(process.env.IMAGE_V3_TEST_LIMIT || 1);
if (!accountId || !apiToken) throw new Error('Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN');
fs.mkdirSync(outputDir, { recursive: true });
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const entries = Object.entries(manifest.images ?? {}).slice(0, testLimit);
function readArticle(slug: string) { return fs.readFileSync(path.join('content/articles', `${slug}.md`), 'utf8'); }
function field(text: string, key: string) { const m = text.match(new RegExp(`^${key}:\\s*"([\\s\\S]*?)"\\s*$`, 'm')); return m ? m[1].replace(/\\"/g, '"') : ''; }
function body(text: string) { return (text.split(/^---$/m).slice(2).join('---').split(/^## Sources$/m)[0] ?? '').replace(/\s+/g, ' ').trim(); }
function brief(title: string, description: string, article: string) {
  return `Original editorial illustration for a premium technology newsroom. Wide 16:9 composition, realistic but clearly illustrative, cinematic natural lighting, strong subject hierarchy, restrained sophisticated palette, no readable text, no captions, no watermarks, no logos, no UI screenshot, no generic neural-network wallpaper. Create a story-specific visual for: ${title}. Context: ${description}. Article context: ${article.slice(0, 1000)}. Show the concrete people, object, event, environment or action that makes this story visually identifiable.`;
}
async function generate(prompt: string) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
  const form = new FormData();
  form.append('prompt', prompt);
  form.append('width', '1024');
  form.append('height', '576');
  const response = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${apiToken}` }, body: form });
  const payload = await response.json() as any;
  if (!response.ok || payload?.success === false) throw new Error(`Cloudflare ${response.status}: ${JSON.stringify(payload).slice(0, 1600)}`);
  const image = payload?.result?.image ?? payload?.result;
  if (typeof image !== 'string') throw new Error(`No image in Cloudflare response: ${JSON.stringify(payload).slice(0, 1600)}`);
  return image;
}
const results: any[] = [];
for (const [slug, meta] of entries) {
  const article = readArticle(slug); const title = field(article, 'title'); const description = field(article, 'description');
  const started = Date.now();
  try {
    const image = await generate(brief(title, description, body(article)));
    const base64 = image.startsWith('data:image/') ? image.split(',')[1] : image;
    const safeSlug = slug.replace(/[^a-z0-9-]/gi, '-');
    fs.writeFileSync(path.join(outputDir, `${safeSlug}.png`), Buffer.from(base64, 'base64'));
    fs.writeFileSync(path.join(outputDir, `${safeSlug}.json`), JSON.stringify({ slug, title, description, currentImage: (meta as any).image, model, width: 1024, height: 576, latencyMs: Date.now() - started }, null, 2));
    results.push({ slug, status: 'PASS', latencyMs: Date.now() - started }); console.log(`PASS ${slug}`);
  } catch (error) { results.push({ slug, status: 'FAIL', error: String(error), latencyMs: Date.now() - started }); console.error(`FAIL ${slug}: ${String(error)}`); }
}
fs.writeFileSync(path.join(outputDir, 'results.json'), JSON.stringify({ testOnly: true, productionTouched: false, model, count: entries.length, results }, null, 2));
if (results.some(x => x.status === 'FAIL')) process.exitCode = 1;
