import fs from 'node:fs';
import { available } from './ai-provider-router.mjs';
import { generateNativeArticle } from './trendforge-native-writer.mjs';
import { articleToMarkdown, editorialGate, slugify } from '../lib/article-engine.js';
import { copyrightSafetyGate } from '../lib/copyright-safety.js';

const input = 'data/scored-trends.json';
const outputDir = 'content/articles';
const marker = 'data/native-writer-published.json';

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
const trends = payload.trends ?? [];
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

console.log(`Native fallback: all providers unavailable; testing ${Math.min(ranked.length, 12)} evidence-backed candidate(s).`);

for (const candidate of ranked.slice(0, 12)) {
  const result = await generateNativeArticle({ candidate, trends, existingTitles });
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
  const copyright = copyrightSafetyGate({ content: article.content, sources: article.sources.map(s => s.url), images: [] });
  if (!editorial.passed || !copyright.passed) {
    console.log(`Native fallback rejected by downstream gates: ${candidate.title}`);
    continue;
  }

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(`${outputDir}/${article.slug}.md`, articleToMarkdown(article));
  fs.mkdirSync('data', { recursive: true });
  fs.writeFileSync(marker, JSON.stringify({
    version: '1.0',
    generatedAt: new Date().toISOString(),
    candidate: { title: candidate.title, category: candidate.category, link: candidate.link },
    diagnostics: result.diagnostics,
    editorial,
    copyright,
  }, null, 2) + '\n');
  console.log(`Native fallback published: ${article.slug}`);
  process.exit(0);
}

console.log('Native fallback: no candidate had enough independent evidence for responsible publication.');
process.exit(0);
