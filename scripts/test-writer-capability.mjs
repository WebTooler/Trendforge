import fs from 'node:fs';
import { generateWithTrendForgeWriter } from './trendforge-writer-engine.mjs';

const decisionPath = 'data/decision-queue.json';
const verificationPath = 'data/source-verification.json';

const readJson = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
const wordCount = (text = '') => text.replace(/\s+/g, ' ').trim().split(/\s+/).filter(Boolean).length;
const headingCount = (text = '') => (text.match(/^##\s+/gm) || []).length;

if (!fs.existsSync(decisionPath) || !fs.existsSync(verificationPath)) {
  throw new Error('Writer capability test requires fresh decision-queue.json and source-verification.json.');
}

const decisions = readJson(decisionPath).decisions ?? [];
const verification = readJson(verificationPath).records ?? [];
const verificationByLink = new Map(verification.map((record) => [record.link, record]));

const candidates = decisions
  .map((decision) => ({ ...decision, verification: verificationByLink.get(decision.link) }))
  .filter((candidate) => candidate.verification)
  .filter((candidate) => candidate.evidenceReady === true || (
    Number(candidate.verification.reachableSourceCount || 0) >= 2 &&
    Number(candidate.verification.uniqueDomainCount || 0) >= 2
  ))
  .sort((a, b) => Number(b.decisionScore || 0) - Number(a.decisionScore || 0));

if (!candidates.length) {
  throw new Error('WRITER_TEST_BLOCKED: no candidate currently meets the multi-source evidence requirement.');
}

const candidate = candidates[0];
const record = candidate.verification;
const sources = [
  ...(Array.isArray(record.sources) ? record.sources : []),
  ...(Array.isArray(record.discoveredSources) ? record.discoveredSources : []),
  ...(Array.isArray(record.reachableSources) ? record.reachableSources : []),
].filter((source) => source && typeof source.url === 'string');

const uniqueSources = [...new Map(sources.map((source) => [source.url, source])).values()].slice(0, 12);
const evidence = Array.isArray(record.evidence) ? record.evidence : [];
const evidenceText = evidence.slice(0, 20).map((item, index) => {
  if (typeof item === 'string') return `${index + 1}. ${item}`;
  return `${index + 1}. ${item.text || item.snippet || item.title || ''}`;
}).filter((text) => text.trim().length > 20).join('\n');

if (uniqueSources.length < 2) {
  throw new Error(`WRITER_TEST_BLOCKED: selected candidate exposes only ${uniqueSources.length} usable source URL(s).`);
}

const prompt = `TITLE: ${candidate.title}\nCATEGORY: ${candidate.category}\nORIGINAL SOURCE: ${candidate.link}\n\nVERIFIED EVIDENCE:\n${evidenceText || 'Use the supplied source pages as the evidence set; do not invent facts.'}\n\nSOURCE SET (candidate-scoped only):\n${uniqueSources.map((source) => `- ${source.title || 'Source'} — ${source.url}`).join('\n')}\n\nWRITER CAPABILITY TEST: Generate one complete original article about ONLY this candidate/story. Do not introduce facts from unrelated stories. Use only the supplied evidence and sources. If the evidence does not support a useful article, return empty fields rather than padding or inventing. Include a Sources section-compatible body, but do not fabricate source metadata.`;

console.log(`WRITER_TEST candidate: ${candidate.category} — ${candidate.title}`);
console.log(`WRITER_TEST decisionScore: ${candidate.decisionScore ?? 'n/a'} | confidence: ${candidate.confidence ?? 'n/a'}`);
console.log(`WRITER_TEST evidence: ${record.reachableSourceCount ?? 0} reachable source(s), ${record.uniqueDomainCount ?? 0} independent domain(s), ${record.discoveredSourceCount ?? 0} discovered source(s).`);
console.log(`WRITER_TEST providers will be selected by the normal AI router; this test never bypasses provider policy.`);

const result = await generateWithTrendForgeWriter({ prompt, category: candidate.category });
const draft = JSON.parse(result.text);
const words = wordCount(draft.content);
const headings = headingCount(draft.content);

console.log(`WRITER_TEST provider: ${result.provider}`);
console.log(`WRITER_TEST generation: SUCCESS`);
console.log(`WRITER_TEST title: ${draft.title}`);
console.log(`WRITER_TEST words: ${words}`);
console.log(`WRITER_TEST H2 count: ${headings}`);
console.log(`WRITER_TEST description chars: ${(draft.description || '').length}`);
console.log('WRITER_TEST publication: NOT PERFORMED (isolated capability test).');

const resultPath = 'writer-capability-result.json';
fs.writeFileSync(resultPath, JSON.stringify({
  passed: true,
  generatedAt: new Date().toISOString(),
  candidate: { title: candidate.title, category: candidate.category, link: candidate.link },
  evidence: { reachableSourceCount: record.reachableSourceCount, uniqueDomainCount: record.uniqueDomainCount, discoveredSourceCount: record.discoveredSourceCount },
  provider: result.provider,
  article: { title: draft.title, description: draft.description, wordCount: words, h2Count: headings, content: draft.content },
}, null, 2) + '\n');
