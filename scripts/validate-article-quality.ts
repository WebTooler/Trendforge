import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { validatePoliticalNeutrality } from './political-neutrality-guard.mjs';

const dir = 'content/articles';
const evidencePath = 'data/evidence-integrity.json';
const authoritativePath = 'data/authoritative-evidence-pack.json';
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort() : [];
if (!files.length) {
  console.log('No articles found; content quality validation skipped.');
  process.exit(0);
}

const errors: string[] = [];
const seenSlugs = new Set<string>();
const seenTitles = new Set<string>();

function field(text: string, key: string) {
  const match = text.match(new RegExp(`^${key}:\\s*\"([\\s\\S]*?)\"\\s*$`, 'm'));
  return match ? match[1].replace(/\\\"/g, '\"') : '';
}

function decodeHtmlEntities(text: string) {
  return text
    .replace(/&#(\\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '\"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function normalize(text: string) {
  return decodeHtmlEntities(text).toLowerCase().replace(/[`*_#>\[\]().,!?;:'\"—–-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeUrl(url: string) {
  try {
    const parsed = new URL(url.trim());
    parsed.hash = '';
    parsed.search = '';
    parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    return parsed.toString();
  } catch {
    return url.trim().replace(/\/+$/, '');
  }
}

function loadEvidenceItems(): any[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
    return Array.isArray(parsed?.report) ? parsed.report : [];
  } catch {
    return [];
  }
}

function evidenceUrls(item: any): string[] {
  const urls: string[] = [];
  if (typeof item?.link === 'string') urls.push(item.link);
  for (const source of Array.isArray(item?.sources) ? item.sources : []) {
    for (const key of ['suppliedUrl', 'finalUrl', 'canonical']) {
      if (typeof source?.[key] === 'string') urls.push(source[key]);
    }
  }
  return [...new Set(urls.map(normalizeUrl).filter(Boolean))];
}

function loadAuthoritativePack() {
  try {
    const root = JSON.parse(fs.readFileSync(authoritativePath, 'utf8'));
    return Array.isArray(root?.candidates) ? root.candidates : [];
  } catch {
    return [];
  }
}
const authoritativePacks = loadAuthoritativePack();
function canonicalEvidenceForBrief(title: string) {
  const pack = authoritativePacks.find((item: any) => item?.candidate?.title === title);
  if (!pack || pack.status !== 'authoritative' || pack.version !== 1) return null;
  const urls = new Set(
    (Array.isArray(pack.sources) ? pack.sources : [])
      .map((s: any) => normalizeUrl(typeof s?.url === 'string' ? s.url : ''))
      .filter(Boolean),
  );
  return urls.size ? { pack, urls } : null;
}

const evidenceItems = loadEvidenceItems();
const evidenceByUrl = new Map<string, any>();
for (const item of evidenceItems) {
  for (const url of evidenceUrls(item)) evidenceByUrl.set(url, item);
}

function resolveEvidence(sourceUrls: string[]) {
  const matches = sourceUrls
    .map(normalizeUrl)
    .map((url) => evidenceByUrl.get(url))
    .filter((item, index, all) => item && all.indexOf(item) === index);

  const validatedSingleSource = matches.some((item) =>
    item?.status === 'pass' &&
    item?.evidenceLevel === 'single-source' &&
    Number(item?.validSourceCount) >= 1
  );

  const strongEvidence = matches.some((item) =>
    item?.status === 'pass' &&
    item?.evidenceLevel === 'strong' &&
    Number(item?.validSourceCount) >= 2 &&
    Number(item?.independentPublisherFamilies ?? 0) >= 2
  );

  return { validatedSingleSource, strongEvidence, matches };
}

function getCurrentRunFiles(): Set<string> {
  try {
    const status = execFileSync('git', ['status', '--porcelain', '--untracked-files=all', '--', dir], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const current = new Set<string>();
    for (const line of status.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const file = line.slice(3).trim();
      if (file.startsWith(`${dir}/`) && file.endsWith('.md')) current.add(path.basename(file));
    }
    return current;
  } catch {
    return new Set<string>();
  }
}

// The quality gate runs after generation, while the generated article is still
// uncommitted. Existing repository articles are baseline content and must not be
// re-qualified against the current run's evidence snapshot. Only files changed
// by this run receive the current-run evidence policy.
const currentRunFiles = getCurrentRunFiles();
let currentBriefTitle = '';
try { currentBriefTitle = String(JSON.parse(fs.readFileSync('data/article-brief.json', 'utf8'))?.brief?.title || '').trim(); } catch {}
console.log(`Quality scope: ${currentRunFiles.size} current-run article(s), ${Math.max(0, files.length - currentRunFiles.size)} baseline article(s).`);

for (const file of files) {
  const raw = fs.readFileSync(path.join(dir, file), 'utf8');
  const parts = raw.split(/^---$/m);
  if (parts.length < 3) {
    errors.push(`${file}: invalid frontmatter structure.`);
    continue;
  }
  const front = parts[1];
  const body = parts.slice(2).join('---').trim();
  const main = body.split(/^## Sources$/m)[0].trim();
  const title = field(front, 'title');
  const description = field(front, 'description');
  const slug = field(front, 'slug') || file.replace(/\.md$/, '');
  const category = field(front, 'category');
  const words = main.split(/\s+/).filter(Boolean).length;
  const headings = (main.match(/^##\s+.+$/gm) || []).length;
  const paragraphs = main
    .split(/\n\s*\n/)
    .map((block) => block.replace(/^##\s+.+\n?/, '').trim())
    .filter((p) => p && !/^\d+\.\s+/.test(p));
  const sourceUrls = [...new Set([...raw.matchAll(/\]\((https:\/\/[^)]+)\)/g)].map((m) => normalizeUrl(m[1])))];
  const unsafe = /<script\b|<iframe\b|javascript\s*:/i.test(raw);
  const evidence = resolveEvidence(sourceUrls);
  const isCurrentRun = currentRunFiles.has(file);
  const canonical = isCurrentRun ? canonicalEvidenceForBrief(currentBriefTitle) : null;
  if (isCurrentRun && !canonical) errors.push(`${slug}: authoritative evidence pack missing or invalid for current run.`);
  const canonicalSourceUrls = canonical ? sourceUrls.filter((url) => canonical.urls.has(url)) : [];

  // Current-run articles must be backed by the authoritative evidence snapshot:
  // a validated single source is sufficient, while strong evidence requires two
  // independent publisher families. Historical/baseline articles are not forced
  // to match today's evidence snapshot; they only need at least one HTTPS source.
  const validatedSingleSource = Boolean(canonical && canonicalSourceUrls.length >= 1 && evidence.validatedSingleSource);
  const requiredSourceLinks = isCurrentRun
    ? (validatedSingleSource ? 1 : evidence.strongEvidence ? 2 : 2)
    : 1;

  if (!title || title.length < 20 || title.length > 110) errors.push(`${slug}: title quality/length check failed.`);
  if (!description || description.length < 80 || description.length > 320) errors.push(`${slug}: description quality/length check failed.`);
  if (description.length >= 300 && !/[.!?…]$/.test(description.trim())) errors.push(`${slug}: description appears truncated or incomplete.`);
  if (!category.trim()) errors.push(`${slug}: missing category.`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) errors.push(`${slug}: invalid slug.`);
  if (seenSlugs.has(slug)) errors.push(`${slug}: duplicate slug.`); else seenSlugs.add(slug);
  const titleKey = normalize(title);
  if (seenTitles.has(titleKey)) errors.push(`${slug}: duplicate title.`); else seenTitles.add(titleKey);
  if (words < 150) errors.push(`${slug}: article is too short (${words} words; minimum 150).`);
  if (headings < 1) errors.push(`${slug}: needs at least 1 useful H2 section (found ${headings}).`);
  if (paragraphs.length < 4) errors.push(`${slug}: needs at least 4 substantive paragraphs.`);
  if (sourceUrls.length < requiredSourceLinks || canonicalSourceUrls.length < requiredSourceLinks || sourceUrls.some((url) => !url.startsWith('https://'))) {
    const policy = isCurrentRun
      ? (validatedSingleSource ? 'validated single-source evidence' : evidence.strongEvidence ? 'strong multi-source evidence' : 'current-run evidence')
      : 'baseline article source sanity';
    errors.push(`${slug}: needs at least ${requiredSourceLinks} HTTPS source link(s) for ${policy}.`);
  }
  if (unsafe) errors.push(`${slug}: unsafe HTML/script content detected.`);

  const normalizedParagraphs = paragraphs.map(normalize).filter((p) => p.length >= 80);
  const paragraphSimilarity=(a:string,b:string)=>{const A=new Set(a.split(/\s+/).filter(w=>w.length>=4)),B=new Set(b.split(/\s+/).filter(w=>w.length>=4));if(!A.size||!B.size)return 0;return[...A].filter(x=>B.has(x)).length/Math.max(1,Math.min(A.size,B.size));};
  const duplicateParagraph = normalizedParagraphs.some((p,i)=>normalizedParagraphs.some((q,j)=>j>i&&(p===q||(Math.min(p.length,q.length)>=140&&paragraphSimilarity(p,q)>=0.88))));
  const sentenceList = main.split(/(?<=[.!?])\s+/).map(s => normalize(s)).filter(Boolean);
  const duplicateSentence = sentenceList.some((s,i)=>i>0 && s.length>=50 && s===sentenceList[i-1]);
  if (duplicateParagraph) errors.push(`${slug}: duplicate substantive paragraph detected.`);
  if (duplicateSentence) errors.push(`${slug}: consecutive duplicate sentence detected.`);

  const genericFailure = /^(click here|read more|lorem ipsum|test article)\.?$/i.test(main.trim());
  if (genericFailure) errors.push(`${slug}: generic/placeholder content detected.`);

  const sourcePolicy = isCurrentRun
    ? validatedSingleSource ? 'single-source validated' : evidence.strongEvidence ? 'strong multi-source validated' : 'current-run evidence required'
    : 'baseline article';
  const articleErrors = errors.some((e) => e.startsWith(`${slug}:`));
  console.log(`QUALITY ${articleErrors ? 'FAIL' : 'PASS'}: ${slug} (${words} words, ${headings} H2s, ${sourceUrls.length} sources, ${sourcePolicy})`);
}

if (errors.length) {
  console.error(`\nContent quality validation FAILED with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`\nContent quality validation PASS: ${files.length} article(s) checked.`);