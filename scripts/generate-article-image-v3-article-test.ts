import fs from 'node:fs';
import path from 'node:path';

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;
const model = process.env.CLOUDFLARE_IMAGE_MODEL || '@cf/black-forest-labs/flux-2-klein-9b';
const outputDir = 'data/image-v3-test';
const width = 1024;
const height = 576;

if (!accountId || !apiToken) throw new Error('Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN');
fs.mkdirSync(outputDir, { recursive: true });

type VisualBrief = {
  coreSubject: string;
  event: string;
  keyObject: string;
  context: string;
  visualConcept: string;
  supportingDetails: string;
  avoid: string;
};

const tests: Array<{ slug: string; brief: VisualBrief }> = [
  {
    slug: 'apple-eyes-2029-ai-server-with-m-series-ultra-chips',
    brief: {
      coreSubject: 'a next-generation enterprise AI server',
      event: 'a future server platform being prepared for large-scale AI data-center use',
      keyObject: 'a premium server chassis containing multiple high-performance processor modules',
      context: 'a modern enterprise data center with dense rack infrastructure',
      visualConcept: 'one powerful new AI server being installed as the hero machine inside a serious data-center environment',
      supportingDetails: 'large processor modules, advanced cooling, high-speed networking hardware, realistic rack cabling, restrained signs of intensive AI computing',
      avoid: 'generic robots, abstract neural-network wallpaper, consumer laptops, gaming PCs, fantasy holograms, unrelated circuit-board closeups',
    },
  },
  {
    slug: 'how-to-move-passwords-and-passkeys-between-managers-on-android',
    brief: {
      coreSubject: 'secure transfer of passwords and passkeys between Android password managers',
      event: 'a safer direct migration flow that avoids creating a downloadable credential export file',
      keyObject: 'an Android smartphone with two abstract secure credential-manager containers connected by a controlled transfer path',
      context: 'a realistic everyday mobile-security setting with the phone as the clear hero subject',
      visualConcept: 'secure credentials moving directly from one protected manager to another while sensitive data remains contained on the device',
      supportingDetails: 'two distinct blank secure vault cards, a clean transfer arrow, a simple passkey-style authentication symbol, subtle Android-like mobile hardware cues without copying any real interface',
      avoid: 'generic hacker, hooded person, giant padlock icon, readable UI, fake app names, password text, binary code wallpaper, desktop server room, sci-fi holograms',
    },
  },
  {
    slug: 'beyond-obscurity-navigating-the-dual-eras-of-drone-threats-and-ai-driven-vulnerabilities',
    brief: {
      coreSubject: 'the changing security threat created by drones and automated AI-driven vulnerability analysis',
      event: 'traditional hidden physical and digital defenses becoming easier to observe, analyze, and bypass',
      keyObject: 'a small reconnaissance drone approaching protected critical infrastructure while a subtle digital security layer is being analyzed',
      context: 'a realistic industrial perimeter with physical barriers, network infrastructure, and a clear aerial viewpoint',
      visualConcept: 'a drone observing a protected facility while the same scene visually connects physical exposure with a vulnerable digital perimeter',
      supportingDetails: 'industrial fence and facility, surveillance sensors, communication equipment, restrained digital attack-surface cues, realistic aerial perspective, tension without depicting active violence',
      avoid: 'battlefield, explosions, missiles, soldiers, gore, generic hooded hacker, excessive red warning graphics, fantasy cyberpunk city, meaningless binary code',
    },
  },
];

function field(text: string, key: string) {
  const m = text.match(new RegExp(`^${key}:\\s*"([\\s\\S]*?)"\\s*$`, 'm'));
  return m ? m[1].replace(/\\"/g, '"') : '';
}

function buildPrompt(brief: VisualBrief) {
  return [
    'Original editorial hero illustration for a premium global technology newsroom.',
    'Wide 16:9 composition. The image must communicate the specific article story at a glance, not merely its broad category.',
    '',
    'STORY VISUAL BRIEF',
    `Core subject: ${brief.coreSubject}.`,
    `Specific event or development: ${brief.event}.`,
    `Key object: ${brief.keyObject}.`,
    `Real-world context: ${brief.context}.`,
    `Main visual concept: ${brief.visualConcept}.`,
    `Supporting details: ${brief.supportingDetails}.`,
    '',
    'EDITORIAL STORYTELLING',
    'Make the core subject unmistakably dominant and visually specific.',
    'Show the relationship between the subject and the event, rather than placing unrelated technology symbols around it.',
    'Use foreground, middle-ground and background depth with a deliberate editorial composition.',
    'Every prominent object must reinforce the story. If a detail does not help explain the story, leave it out.',
    'Favor one strong visual metaphor grounded in believable real-world objects over a collage of generic technology imagery.',
    '',
    'STYLE AND CRAFT',
    'Premium technology magazine editorial illustration with photography-informed composition.',
    'Plausible industrial or consumer hardware design, realistic materials, natural cinematic lighting, sophisticated restrained palette, convincing scale and depth.',
    'Polished art direction, subtle visual drama, clean hierarchy, professional newsroom hero-image quality.',
    'Avoid stock-illustration appearance and avoid repetitive template-like composition.',
    '',
    'CROP AND LAYOUT',
    'Keep the primary subject readable at thumbnail size.',
    'Preserve useful negative space around the focal subject for responsive article-card crops.',
    'Do not place essential visual information at the extreme edges.',
    '',
    'TEXT AND BRAND CONTROL',
    'Absolutely no readable text anywhere in the image.',
    'All screens, labels, signs, badges, interfaces and panels must be blank, abstract, or purely graphical with no glyphs or words.',
    'All hardware surfaces must be unbranded: no logos, brand marks, product names, serial labels or recognizable trademark shapes.',
    'Do not invent fake company names or pseudo-readable lettering.',
    '',
    'DO NOT DEVIATE',
    `Avoid: ${brief.avoid}.`,
    'No captions, headlines, watermarks, fake screenshots, or copied publication artwork.',
    'No misleading photorealistic depiction of a real person.',
    '',
    'FINAL PRIORITY',
    'Story relevance > subject clarity > factual visual grounding > composition > clean brand-safe rendering > realism > decorative detail.',
  ].join('\n');
}

async function generateOne(test: (typeof tests)[number]) {
  const articlePath = path.join('content/articles', `${test.slug}.md`);
  if (!fs.existsSync(articlePath)) throw new Error(`Missing article: ${articlePath}`);

  const article = fs.readFileSync(articlePath, 'utf8');
  const title = field(article, 'title');
  const description = field(article, 'description');
  const prompt = buildPrompt(test.brief);

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

  console.log(`ARTICLE_TEST slug=${test.slug}`);
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
  const output = path.join(outputDir, `${test.slug}.png`);
  fs.writeFileSync(output, Buffer.from(base64, 'base64'));
  fs.writeFileSync(path.join(outputDir, `${test.slug}.json`), JSON.stringify({
    testOnly: true,
    productionTouched: false,
    slug: test.slug,
    title,
    description,
    model,
    width,
    height,
    visualBrief: test.brief,
    prompt,
    httpStatus: response.status,
    elapsedMs,
    imageBytes: Buffer.byteLength(base64, 'base64'),
    output,
    generatedAt: new Date().toISOString(),
  }, null, 2));
  console.log(`PASS real article image generated in ${elapsedMs}ms: ${output}`);
}

async function generate() {
  let failures = 0;
  for (const test of tests) {
    try {
      await generateOne(test);
    } catch (error) {
      failures += 1;
      fs.writeFileSync(path.join(outputDir, `${test.slug}-error.json`), JSON.stringify({
        testOnly: true,
        productionTouched: false,
        slug: test.slug,
        status: 'FAIL',
        error: String(error),
        generatedAt: new Date().toISOString(),
      }, null, 2));
      console.error(`FAIL real article image: ${test.slug}: ${String(error)}`);
    }
  }
  if (failures > 0) process.exitCode = 1;
}

generate().catch((error) => {
  console.error(`FAIL image V3 test harness: ${String(error)}`);
  process.exitCode = 1;
});
