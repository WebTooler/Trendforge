import fs from 'node:fs';
import path from 'node:path';

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;
const model = process.env.CLOUDFLARE_IMAGE_MODEL || '@cf/black-forest-labs/flux-2-dev';
const manifestPath = 'data/image-manifest.json';
const outputDir = 'data/image-v3-test';

if (!accountId || !apiToken) throw new Error('Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN');
if (!fs.existsSync(manifestPath)) throw new Error(`Missing ${manifestPath}`);
fs.mkdirSync(outputDir, { recursive: true });

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const entries = Object.entries(manifest.images ?? {});
if (!entries.length) throw new Error('No published images found in image manifest');

function readArticle(slug: string) {
  const file = path.join('content/articles', `${slug}.md`);
  if (!fs.existsSync(file)) throw new Error(`Missing published article: ${file}`);
  return fs.readFileSync(file, 'utf8');
}
function field(text: string, key: string) {
  const m = text.match(new RegExp(`^${key}:\\s*"([\\s\\S]*?)"\\s*$`, 'm'));
  return m ? m[1].replace(/\\"/g, '"') : '';
}
function body(text: string) {
  const parts = text.split(/^---$/m);
  return (parts.slice(2).join('---').split(/^## Sources$/m)[0] ?? '').replace(/\s+/g, ' ').trim();
}

function briefFor(slug: string, title: string, description: string, article: string) {
  const base = 'Original editorial illustration for a technology publication. Landscape 16:9 composition, sophisticated newsroom visual language, realistic but clearly illustrative, cinematic natural lighting, strong subject hierarchy, restrained color palette, no logos, no readable text, no captions, no watermarks, no UI screenshot, no generic abstract neural network wallpaper.';
  const briefs: Record<string, string> = {
    'ai-co-founders-how-gusto-insight-partners-and-leland-are-reshaping-startup-hiring-at-disru': `${base} Show an early-stage startup team in a modern meeting room with two human founders and a clearly defined AI agent represented as a luminous digital collaborator at the table. The composition should communicate hiring, delegation and human-AI teamwork rather than generic AI. Subtle conference-stage context in the background, diverse professional people, documentary editorial feel.`,
    'al-gore-says-the-real-ai-risk-isn-t-data-centers': `${base} Editorial conceptual scene combining Al Gore as the recognizable central public figure in a thoughtful interview-style setting, a large AI data-center infrastructure behind him, and renewable solar power entering the scene. Visually contrast physical data-center emissions concerns with the broader societal risks of AI; serious magazine-news illustration, not a portrait-only image.`,
    'anthropic-s-ceo-calls-for-an-ai-slow-down-what-it-means-for-the-industry': `${base} Show Anthropic CEO Dario Amodei in a serious policy-and-technology setting, with powerful AI model infrastructure on one side and a visible safety brake / controlled slowdown motif on the other. Convey tension between rapid capability growth and safety governance. Editorial illustration, restrained and credible, not sci-fi fantasy.`,
    'apple-eyes-2029-ai-server-with-m-series-ultra-chips': `${base} Show a premium enterprise AI server rack designed as a plausible Apple-class hardware product, with several powerful processor modules inside and high-speed data-center networking. Apple-inspired industrial design without reproducing trademarks or logos. Emphasize server hardware, chips, cooling and data-center infrastructure; no generic robot brain.`,
    'beyond-obscurity-navigating-the-dual-eras-of-drone-threats-and-ai-driven-vulnerabilities': `${base} Split-concept editorial scene: a surveillance/security drone approaching critical infrastructure in the upper physical world while an AI security analysis system exposes hidden vulnerabilities in code/network architecture below. The two halves should visually connect to communicate that both physical perimeters and digital obscurity are being defeated.`,
    'comp-ai-raises-34m-series-a-to-build-agentic-security-and-compliance-platform': `${base} Show a modern cybersecurity/compliance operations environment where autonomous AI agents continuously inspect permissions, security controls and audit evidence. Include a subtle funding-growth cue such as an upward financial chart in the background, but keep the main story about automated security and compliance monitoring. Avoid generic hacker imagery.`,
    'exclusive-paying-for-frontier-ai-models-buys-4-month-head-start-at-5x-the-cost': `${base} Show a visual comparison between two AI computing paths: an expensive polished frontier-model system accelerating ahead on one side and an open-weight model stack rapidly closing the gap on the other. Include a subtle cost-versus-performance/time metaphor, with four-month head-start and price premium implied visually but without text.`,
    'how-to-move-passwords-and-passkeys-between-managers-on-android': `${base} Show a modern Android phone at the center with secure credential/passkey symbols moving directly from one password-manager vault to another through a protected system-level transfer path. Make the visual communicate safe portability without an export file. Clean practical consumer-tech editorial illustration.`,
    'how-to-set-up-a-passkey-for-your-google-account': `${base} Show a modern smartphone or laptop displaying a secure account sign-in concept with a fingerprint/face-unlock/passkey interaction and a protected device boundary. Emphasize phishing-resistant authentication and device ownership. Practical technology explainer illustration, not a generic cybersecurity server room.`,
    'how-to-update-android-apps-safely-and-keep-them-current': `${base} Show an Android smartphone with several app tiles being safely updated, a secure download/update pathway, and subtle security shield cues. The scene should look like a practical consumer-tech guide image, with no readable interface text and no generic cyberattack imagery.`,
    'iranian-strikes-wipe-out-amazon-cloud-data-in-bahrain-uae': `${base} Serious geopolitical technology-news illustration showing a Middle Eastern data-center facility damaged by a distant missile/drone strike, with server racks and cloud infrastructure visibly affected. Convey irreversible physical destruction and data loss without graphic casualties. Include geographic Gulf-region visual cues but no flags or political propaganda.`,
  };
  return briefs[slug] ?? `${base} Create a story-specific visual based on this article: ${title}. Key context: ${description}. Article themes: ${article.slice(0, 900)}.`;
}

async function generate(prompt: string) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
  const form = new FormData();
  form.append('prompt', prompt);
  const response = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${apiToken}` }, body: form });
  const payload = await response.json() as any;
  if (!response.ok || payload?.success === false) throw new Error(`Cloudflare ${response.status}: ${JSON.stringify(payload).slice(0, 1200)}`);
  const image = payload?.result?.image ?? payload?.result;
  if (typeof image !== 'string') throw new Error(`Cloudflare response did not contain a base64 image: ${JSON.stringify(payload).slice(0, 1200)}`);
  return image;
}

const results: any[] = [];
for (const [slug, meta] of entries) {
  const article = readArticle(slug);
  const title = field(article, 'title');
  const description = field(article, 'description');
  const prompt = briefFor(slug, title, description, body(article));
  const safeSlug = slug.replace(/[^a-z0-9-]/gi, '-');
  const started = Date.now();
  try {
    const image = await generate(prompt);
    const base64 = image.startsWith('data:image/') ? image.split(',')[1] : image;
    fs.writeFileSync(path.join(outputDir, `${safeSlug}.png`), Buffer.from(base64, 'base64'));
    fs.writeFileSync(path.join(outputDir, `${safeSlug}.json`), JSON.stringify({ slug, title, description, currentImage: (meta as any).image, model, prompt, generatedAt: new Date().toISOString(), latencyMs: Date.now() - started }, null, 2));
    results.push({ slug, status: 'PASS', latencyMs: Date.now() - started, output: `${safeSlug}.png` });
    console.log(`PASS ${slug}`);
  } catch (error) {
    results.push({ slug, status: 'FAIL', error: String(error), latencyMs: Date.now() - started });
    console.error(`FAIL ${slug}: ${String(error)}`);
  }
}
fs.writeFileSync(path.join(outputDir, 'results.json'), JSON.stringify({ testOnly: true, productionTouched: false, writingPipelineTouched: false, model, count: entries.length, results }, null, 2));
const failures = results.filter((x) => x.status === 'FAIL').length;
console.log(`Image V3 test complete: ${entries.length - failures}/${entries.length} generated. Production images and article files were not modified.`);
if (failures) process.exitCode = 1;
