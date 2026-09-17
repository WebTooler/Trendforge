import fs from 'node:fs';

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;
const model = process.env.CLOUDFLARE_IMAGE_MODEL || '@cf/black-forest-labs/flux-2-klein-9b';
const outputDir = 'data/image-v3-test';
const diagnosticVersion = 'v2-exact-multipart-512';

if (!accountId || !apiToken) throw new Error('Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN');
fs.mkdirSync(outputDir, { recursive: true });

// Diagnostic only: deliberately remove article/prompt complexity.
// One tiny request proves whether the Cloudflare REST inference path itself works.
const prompt = 'A single red apple on a white studio table, editorial product photograph, clean background.';
const width = 512;
const height = 512;
const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;

async function generate() {
  const form = new FormData();
  form.append('prompt', prompt);
  form.append('width', String(width));
  form.append('height', String(height));

  // Force Node to serialize the multipart body first so we can forward the
  // exact generated boundary in Content-Type. This follows Cloudflare's
  // documented multipart-boundary handling pattern.
  const serialized = new Request(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiToken}` },
    body: form,
  });
  const contentType = serialized.headers.get('content-type');
  if (!contentType?.startsWith('multipart/form-data;')) {
    throw new Error(`Unexpected multipart Content-Type: ${contentType ?? 'missing'}`);
  }
  const body = await serialized.arrayBuffer();

  console.log(`DIAGNOSTIC version=${diagnosticVersion}`);
  console.log(`DIAGNOSTIC model=${model}`);
  console.log(`DIAGNOSTIC dimensions=${width}x${height}`);
  console.log(`DIAGNOSTIC contentType=${contentType}`);
  console.log(`DIAGNOSTIC requestBytes=${body.byteLength}`);

  const started = Date.now();
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': contentType,
      'Content-Length': String(body.byteLength),
    },
    body,
  });
  const elapsedMs = Date.now() - started;
  const raw = await response.text();
  console.log(`DIAGNOSTIC httpStatus=${response.status}`);
  console.log(`DIAGNOSTIC elapsedMs=${elapsedMs}`);
  console.log(`DIAGNOSTIC contentTypeResponse=${response.headers.get('content-type') ?? 'missing'}`);

  let payload: any;
  try { payload = JSON.parse(raw); } catch { payload = null; }
  if (!response.ok || payload?.success === false) {
    throw new Error(`Cloudflare ${response.status} after ${elapsedMs}ms: ${raw.slice(0, 4000)}`);
  }

  const image = payload?.result?.image ?? payload?.result;
  if (typeof image !== 'string') {
    throw new Error(`Cloudflare returned no base64 image after ${elapsedMs}ms: ${raw.slice(0, 4000)}`);
  }

  const base64 = image.startsWith('data:image/') ? image.split(',')[1] : image;
  fs.writeFileSync(`${outputDir}/cloudflare-smoke.png`, Buffer.from(base64, 'base64'));
  fs.writeFileSync(`${outputDir}/cloudflare-smoke-diagnostics.json`, JSON.stringify({
    testOnly: true,
    productionTouched: false,
    diagnosticVersion,
    model,
    prompt,
    width,
    height,
    httpStatus: response.status,
    elapsedMs,
    responseContentType: response.headers.get('content-type'),
    imageBytes: Buffer.byteLength(base64, 'base64'),
    generatedAt: new Date().toISOString(),
  }, null, 2));
  console.log(`PASS Cloudflare smoke image generated in ${elapsedMs}ms`);
}

generate().catch((error) => {
  fs.writeFileSync(`${outputDir}/cloudflare-smoke-diagnostics.json`, JSON.stringify({
    testOnly: true,
    productionTouched: false,
    diagnosticVersion,
    model,
    prompt,
    width,
    height,
    status: 'FAIL',
    error: String(error),
    generatedAt: new Date().toISOString(),
  }, null, 2));
  console.error(`FAIL Cloudflare smoke: ${String(error)}`);
  process.exitCode = 1;
});
