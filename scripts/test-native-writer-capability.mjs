import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { generateNativeArticle } from './trendforge-native-writer.mjs';
import { articleToMarkdown, editorialGate, slugify } from '../lib/article-engine.ts';
import { copyrightSafetyGate } from '../lib/copyright-safety.ts';

const decisionPath = 'data/decision-queue.json';
const verificationPath = 'data/source-verification.json';
const articleDir = 'content/articles';
const markerPath = 'data/native-writer-published.json';
const resultPath = 'native-writer-capability-result.json';

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const clean = (v = '') => String(v).replace(/\s+/g, ' ').trim();
const words = (v = '') => clean(v).split(/\s+/).filter(Boolean);
const tokens = (v = '') => new Set(clean(v).toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(x => x.length > 3));
const overlap = (a, b) => { const A = tokens(a); const B = tokens(b); return [...A].filter(x => B.has(x)).length; };
const headings = (v = '') => (v.match(/^##\s+.+$/gm) || []).length;
const paragraphs = (v = '') => v.split(/\n\s*\n/).map(x => x.replace(/^##\s+.+\n?/, '').trim()).filter(x => x && !/^\d+\.\s+/.test(x));

if (!fs.existsSync(decisionPath) || !fs.existsSync(verificationPath)) {
  throw new Error('NATIVE_WRITER_TEST_BLOCKED: fresh decision-queue.json and source-verification.json are required.');
}

const decisions = readJson(decisionPath).decisions ?? [];
const verification = readJson(verificationPath).records ?? [];
const byLink = new Map(verification.map(r => [r.link, r]));
const existingTitles = new Set();
if (fs.existsSync(articleDir)) {
  for (const file of fs.readdirSync(articleDir).filter(f => f.endsWith('.md'))) {
    const raw = fs.readFileSync(`${articleDir}/${file}`, 'utf8');
    const title = raw.match(/^title:\s*"([\s\S]*?)"\s*$/m)?.[1];
    if (title) existingTitles.add(title.toLowerCase().trim());
  }
}

const candidates = decisions
  .map(d => ({ ...d, verification: byLink.get(d.link) }))
  .filter(d => d.verification)
  .filter(d => d.evidenceReady === true || (Number(d.verification.reachableSourceCount || 0) >= 2 && Number(d.verification.uniqueDomainCount || 0) >= 2))
  .filter(d => !existingTitles.has(String(d.title || '').toLowerCase().trim()))
  .sort((a, b) => Number(b.decisionScore || 0) - Number(a.decisionScore || 0));

if (!candidates.length) throw new Error('NATIVE_WRITER_TEST_BLOCKED: no fresh candidate meets the multi-source evidence requirement.');

const generated = [];
const blocked = [];

function semanticAudit(candidate, result) {
  const article = result.article;
  const body = article.content;
  const ps = paragraphs(body);
  const titleOverlap = overlap(candidate.title, article.title);
  const sectionBodies = ps.filter(p => !p.startsWith('The story is worth following because'));
  const sourceTexts = article.sourceTexts || [];
  const evidenceBackedParagraphs = sectionBodies.filter(p => sourceTexts.some(s => overlap(p, s) >= 2)).length;
  const unrelatedParagraphs = sectionBodies.filter(p => {
    const topic = overlap(p, candidate.title);
    const source = Math.max(...sourceTexts.map(s => overlap(p, s)), 0);
    return topic === 0 && source < 2;
  }).length;
  const normalized = ps.map(p => clean(p).toLowerCase()).filter(p => p.length >= 80);
  const duplicateParagraphs = normalized.filter((p, i) => normalized.indexOf(p) !== i).length;
  const fillerHits = (body.match(/in today's fast|game changer|revolutionary era|it is important to note|in conclusion/gi) || []).length;
  const artifactHits = (body.match(/&amp;#|&#\d+;|\bSource\b,?\s+(reports|says|indicates)|\bUnknown\b|\bundefined\b/gi) || []).length;
  const h2 = headings(body);
  const wc = words(body).length;
  const evidenceTarget = Math.max(4, Math.ceil(sectionBodies.length * 0.7));
  const passed = titleOverlap >= 2 && wc >= 700 && h2 >= 4 && ps.length >= 6 && evidenceBackedParagraphs >= evidenceTarget && unrelatedParagraphs === 0 && duplicateParagraphs === 0 && fillerHits === 0 && artifactHits === 0;
  return { passed, wordCount: wc, h2Count: h2, paragraphCount: ps.length, titleOverlap, evidenceBackedParagraphs, evidenceParagraphTarget: evidenceTarget, unrelatedParagraphs, duplicateParagraphs, fillerHits, artifactHits };
}

for (const selected of candidates.slice(0, 5)) {
  const record = selected.verification;
  // The production fallback must consume the complete candidate-scoped verified source set,
  // including discovered publisher sources, not just the original seed links.
  const verifiedSources = [
    ...(Array.isArray(record.sources) ? record.sources : []),
    ...(Array.isArray(record.discoveredSources) ? record.discoveredSources : []),
    ...(Array.isArray(record.reachableSources) ? record.reachableSources : []),
  ]
    .filter(s => s && typeof s.url === 'string' && s.url.startsWith('http'))
    .filter((s, i, arr) => arr.findIndex(x => x.url === s.url) === i)
    .slice(0, 10);
  const candidate = { ...selected, sources: verifiedSources };

  console.log(`NATIVE_TEST candidate: ${candidate.category} — ${candidate.title}`);
  console.log(`NATIVE_TEST evidence: ${record.reachableSourceCount ?? 0} reachable source(s), ${record.uniqueDomainCount ?? 0} independent domain(s), ${record.discoveredSourceCount ?? 0} discovered source(s).`);
  console.log(`NATIVE_TEST source set: ${verifiedSources.length} candidate-scoped verified/reachable source URL(s).`);

  const result = await generateNativeArticle({ candidate, existingTitles });
  if (!result.ok) {
    blocked.push({ title: candidate.title, category: candidate.category, reason: result.reason });
    console.log(`NATIVE_TEST writer: BLOCKED — ${result.reason}`);
    continue;
  }

  const article = { ...result.article, slug: slugify(result.article.title), generatedAt: new Date().toISOString(), author: 'Tejendra Pal Singh' };
  const editorial = editorialGate(article);
  const copyright = copyrightSafetyGate({ content: article.content, sources: article.sources.map(s => s.url), sourceTexts: article.sourceTexts, images: [] });
  const semantic = semanticAudit(candidate, result);

  fs.mkdirSync(articleDir, { recursive: true });
  const articlePath = `${articleDir}/${article.slug}.md`;
  fs.writeFileSync(articlePath, articleToMarkdown(article));
  fs.mkdirSync('data', { recursive: true });
  fs.writeFileSync(markerPath, JSON.stringify({ version: '2.0-native-test', generatedAt: new Date().toISOString(), candidate: { title: candidate.title, category: candidate.category, link: candidate.link }, diagnostics: result.diagnostics, editorial, copyright }, null, 2) + '\n');

  let writerGate = { passed: false, output: '' };
  let qualityGate = { passed: false, output: '' };
  let claimGate = { passed: false, output: '' };
  try {
    writerGate.output = execFileSync('node', ['scripts/validate-writer-output.mjs'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    writerGate.passed = true;
  } catch (e) { writerGate.output = `${e.stdout || ''}${e.stderr || ''}`; }
  try {
    qualityGate.output = execFileSync('npx', ['tsx', 'scripts/validate-article-quality.ts'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    qualityGate.passed = true;
  } catch (e) { qualityGate.output = `${e.stdout || ''}${e.stderr || ''}`; }
  try {
    claimGate.output = execFileSync('node', ['scripts/verify-article-claims.mjs'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    claimGate.passed = true;
  } catch (e) { claimGate.output = `${e.stdout || ''}${e.stderr || ''}`; }

  const allTextualGates = writerGate.passed && qualityGate.passed && claimGate.passed && editorial.passed && copyright.passed && semantic.passed;
  generated.push({
    candidate: { title: candidate.title, category: candidate.category, link: candidate.link },
    article: { path: articlePath, title: article.title, description: article.description, content: article.content },
    diagnostics: result.diagnostics,
    gates: { nativeWriter: true, writerOutput: writerGate.passed, editorial: editorial.passed, copyright: copyright.passed, quality: qualityGate.passed, claims: claimGate.passed, semantic: semantic.passed, allTextualGates },
    semantic,
    gateOutput: { writerOutput: writerGate.output, quality: qualityGate.output, claims: claimGate.output },
  });

  console.log(`NATIVE_TEST gates: writer=${writerGate.passed ? 'PASS' : 'FAIL'} editorial=${editorial.passed ? 'PASS' : 'FAIL'} copyright=${copyright.passed ? 'PASS' : 'FAIL'} quality=${qualityGate.passed ? 'PASS' : 'FAIL'} claims=${claimGate.passed ? 'PASS' : 'FAIL'} semantic=${semantic.passed ? 'PASS' : 'FAIL'}`);
  console.log(`NATIVE_TEST article: ${article.title} — ${semantic.wordCount} words, ${semantic.h2Count} H2, ${semantic.evidenceBackedParagraphs}/${semantic.evidenceParagraphTarget} evidence-backed paragraphs.`);
  break;
}

const winner = generated.find(x => x.gates.allTextualGates);
const passed = Boolean(winner);
const result = { version: '1.0', generatedAt: new Date().toISOString(), mode: 'provider-outage-native-writer-quality-test', passed, publication: 'NOT_PERFORMED', candidatesConsidered: candidates.slice(0, 5).length, blocked, generated };
fs.writeFileSync(resultPath, JSON.stringify(result, null, 2) + '\n');

if (passed) {
  console.log('NATIVE_TEST RESULT: PASS — Native Writer produced an article that passed production textual gates and semantic quality checks.');
  process.exit(0);
}
console.error('NATIVE_TEST RESULT: FAIL — Native Writer did not produce an article passing all required textual/semantic gates.');
process.exit(1);
