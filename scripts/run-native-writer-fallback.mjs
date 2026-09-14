import fs from 'node:fs';
import { available } from './ai-provider-router.mjs';
import { generateNativeArticle } from './trendforge-native-writer.mjs';
import { articleToMarkdown, editorialGate, slugify } from '../lib/article-engine.ts';
import { copyrightSafetyGate } from '../lib/copyright-safety.ts';

const input = 'data/scored-trends.json';
const verificationInput = 'data/source-verification.json';
const outputDir = 'content/articles';
const marker = 'data/native-writer-published.json';

// Production runtime guard: Native Writer quality thresholds remain unchanged,
// but network-heavy hydration must never hold the pipeline indefinitely.
const CANDIDATE_BUDGET_MS = 12000;
const TOTAL_BUDGET_MS = 90000;
const MAX_CANDIDATES = 12;
const startedAt = Date.now();

const withTimeout = async (promise, timeoutMs) => {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((resolve) => {
        timer = setTimeout(() => resolve({ ok: false, reason: `native writer candidate budget exceeded (${timeoutMs}ms)` }), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

if (fs.existsSync(marker)) fs.rmSync(marker);
if (available.length > 0) {
  console.log(`Native fallback: ${available.length} AI provider(s) available; normal Writer Engine remains authoritative.`);
  process.exit(0);
}
if (!fs.existsSync(input)) {
  console.log('Native fallback: no scored trends available.');
  process.exit(0);
}

const payload = JSON.parse(fs.readFileSync(input, 'utf8'));
const verification = fs.existsSync(verificationInput) ? JSON.parse(fs.readFileSync(verificationInput, 'utf8')) : { records: [] };
const verifiedByLink = new Map((verification.records ?? []).map(r => [r.link, r]));
const rawTrends = payload.trends ?? [];
const trends = rawTrends.map(item => {
  const record = verifiedByLink.get(item.link);
  return record?.sources?.length ? { ...item, sources: record.sources.filter(s => s.ok && s.url) } : item;
});
const existingTitles = new Set();
if (fs.existsSync(outputDir)) {
  for (const file of fs.readdirSync(outputDir).filter(n => n.endsWith('.md'))) {
    const raw = fs.readFileSync(`${outputDir}/${file}`, 'utf8');
    const title = raw.match(/^title:\s*"([\s\S]*?)"\s*$/m)?.[1];
    if (title) existingTitles.add(title.toLowerCase().trim());
  }
}

const ranked = trends
  .filter(x => x?.eligible && !existingTitles.has(String(x.title || '').toLowerCase().trim()))
  .sort((a,b) => (b.decisionScore ?? b.score ?? 0) - (a.decisionScore ?? a.score ?? 0));

console.log(`Native fallback: all providers unavailable; testing ${Math.min(ranked.length, MAX_CANDIDATES)} isolated evidence-backed candidate(s).`);
console.log(`Native fallback runtime guard: ${CANDIDATE_BUDGET_MS}ms/candidate, ${TOTAL_BUDGET_MS}ms total; quality thresholds unchanged.`);

for (const candidate of ranked.slice(0, MAX_CANDIDATES)) {
  const elapsed = Date.now() - startedAt;
  if (elapsed >= TOTAL_BUDGET_MS) {
    console.log(`Native fallback stopped: total runtime budget reached (${TOTAL_BUDGET_MS}ms).`);
    break;
  }

  const remaining = Math.min(CANDIDATE_BUDGET_MS, TOTAL_BUDGET_MS - elapsed);
  const result = await withTimeout(
    generateNativeArticle({ candidate, existingTitles }),
    remaining,
  );

  if (!result.ok) {
    console.log(`Native fallback skipped: ${candidate.category} — ${candidate.title} — ${result.reason}`);
    continue;
  }

  const article = {
    ...result.article,
    slug: slugify(result.article.title),
    generatedAt: new Date().toISOString(),
    author: 'Tejendra Pal Singh',
  };
  const editorial = editorialGate(article);
  const copyright = copyrightSafetyGate({
    content: article.content,
    sources: article.sources.map(s => s.url),
    sourceTexts: article.sourceTexts,
    images: []
  });
  if (!editorial.passed || !copyright.passed) {
    console.log(`Native fallback rejected by downstream gates: ${candidate.title}`);
    continue;
  }

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(`${outputDir}/${article.slug}.md`, articleToMarkdown(article));
  fs.mkdirSync('data', { recursive: true });
  fs.writeFileSync(marker, JSON.stringify({
    version: '2.0',
    generatedAt: new Date().toISOString(),
    candidate: { title: candidate.title, category: candidate.category, link: candidate.link },
    diagnostics: result.diagnostics,
    editorial,
    copyright,
  }, null, 2) + '\n');
  console.log(`Native fallback published: ${article.slug}`);
  process.exit(0);
}

console.log(`Native fallback: no candidate had enough isolated, topic-relevant evidence within the ${TOTAL_BUDGET_MS}ms runtime budget.`);
process.exit(0);
