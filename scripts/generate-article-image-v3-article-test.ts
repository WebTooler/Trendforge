import fs from 'node:fs';
import path from 'node:path';

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;
const model = process.env.CLOUDFLARE_IMAGE_MODEL || '@cf/black-forest-labs/flux-2-klein-9b';
const slug = 'apple-eyes-2029-ai-server-with-m-series-ultra-chips';
const articlePath = path.join('content/articles', `${slug}.md`);
const outputDir = 'data/image-v3-test';
const width = 1024;
const height = 576;

if (!accountId || !apiToken) throw new Error('Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN');
if (!fs.existsSync(articlePath)) throw new Error(`Missing article: ${articlePath}`);
fs.mkdirSync(outputDir, { recursive: true });

const article = fs.readFileSync(articlePath, 'utf8');
function field(text: string, key: string) {
  const m = text.match(new RegExp(`^${key}:\\s*"([\\s\\S]*?)"\\s*$`, 'm'));
  return m ? m[1].replace(/\\"/g, '"') : '';
}

const title = field(article, 'title');
const description = field(article, 'description');
// The visual brief is deliberately curated from the story instead of sending
// the raw article/title to the image safety filter. Brand names, people and
// other sensitive entities can be represented by visual concepts without
// requiring the generator to reproduce trademarks or a real person's face.
const visualBrief = 'A cutting-edge enterprise AI server system being prepared for a future-generation data center. Show a premium minimalist server chassis with several large high-performance processor modules, dense high-speed networking, advanced cooling and clean rack infrastructure. Make the physical server hardware the unmistakable hero subject, with subtle signs of AI computing workload in the surrounding data center. Premium technology magazine editorial illustration, plausible industrial design, realistic materials, cinematic natural lighting, sophisticated restrained palette, strong depth and composition. No people, no logos, no trademarks, no readable text, no captions, no watermark, no UI screenshot, no generic robot, no abstract neural-network wallpaper.';
const prompt = `Original editorial illustration for a premium technology newsroom. Wide 16:9 composition. ${visualBrief}`;

async function generate() {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
  const form = new FormData();
  form.append('prompt', prompt);
  form.append('width', String(width));
  form.append('height', String(height));

  const serialized = new Request(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiToken}` },
    body: form,
  });
  const contentType = serialized.headers.get('content-type');
  if (!contentType?.startsWith('multipart/form-data;')) {
    throw new Error(`Unexpected multipart Content-Type: ${contentType ?? 'missing'}`);
  }
  const requestBody = await serialized.arrayBuffer();

  console.log(`ARTICLE_TEST slug=${slug}`);
  console.log(`ARTICLE_TEST title=${title}`);
  console.log(`ARTICLE_TEST model=${model}`);
  console.log(`ARTICLE_TEST dimensions=${width}x${height}`);
  console.log(`ARTICLE_TEST requestBytes=${requestBody.byteLength}`);

  const started = Date.now();
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': contentType,
      'Content-Length': String(requestBody.byteLength),
    },
    body: requestBody,
  });
  const elapsedMs = Date.now() - started;
  const raw = await response.text();
  console.log(`ARTICLE_TEST httpStatus=${response.status}`);
  console.log(`ARTICLE_TEST elapsedMs=${elapsedMs}`);
  console.log(`ARTICLE_TEST responseContentType=${response.headers.get('content-type') ?? 'missing'}`);

  let payload: any;
  try { payload = JSON.parse(raw); } catch { payload = null; }
  if (!response.ok || payload?.success === false) {
    throw new Error(`Cloudflare ${response.status} after ${elapsedMs}ms: ${raw.slice(0, 5000)}`);
  }
  const image = payload?.result?.image ?? payload?.result;
  if (typeof image !== 'string') {
    throw new Error(`Cloudflare returned no base64 image after ${elapsedMs}ms: ${raw.slice(0, 5000)}`);
  }
  const base64 = image.startsWith('data:image/') ? image.split(',')[1] : image;
  const output = path.join(outputDir, `${slug}.png`);
  fs.writeFileSync(output, Buffer.from(base64, 'base64'));
  fs.writeFileSync(path.join(outputDir, `${slug}.json`), JSON.stringify({
    testOnly: true,
    productionTouched: false,
    slug,
    title,
    description,
    model,
    width,
    height,
    visualBrief,
    prompt,
    httpStatus: response.status,
    elapsedMs,
    imageBytes: Buffer.byteLength(base64, 'base64'),
    output,
    generatedAt: new Date().toISOString(),
  }, null, 2));
  console.log(`PASS real article image generated in ${elapsedMs}ms: ${output}`);
}

generate().catch((error) => {
  fs.writeFileSync(path.join(outputDir, `${slug}-error.json`), JSON.stringify({
    testOnly: true,
    productionTouched: false,
    slug,
    title,
    model,
    width,
    height,
    status: 'FAIL',
    error: String(error),
    generatedAt: new Date().toISOString(),
  }, null, 2));
  console.error(`FAIL real article image: ${String(error)}`);
  process.exitCode = 1;
});
