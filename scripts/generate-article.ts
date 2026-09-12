import fs from 'node:fs';
import { articleToMarkdown, buildArticlePrompt, editorialGate, slugify, type ArticleBrief } from '../lib/article-engine';

const input = 'data/scored-trends.json';
const outputDir = 'content/articles';

if (!fs.existsSync(input)) {
  console.log(`No ${input} found; nothing to generate.`);
  process.exit(0);
}

const payload = JSON.parse(fs.readFileSync(input, 'utf8')) as { trends?: Array<ArticleBrief & { eligible?: boolean; score?: number }> };
const trend = payload.trends?.find((item) => item.eligible);

if (!trend) {
  console.log('No eligible trend found.');
  process.exit(0);
}

// Provider-neutral mode: without an AI API key, create a research brief for the future writer.
// This intentionally does not publish invented article text.
const brief: ArticleBrief = {
  title: trend.title,
  category: trend.category,
  angle: 'Explain what changed, why it matters, what is known versus uncertain, and what readers should watch next.',
  keyPoints: [trend.description ?? 'Use the verified source context to identify the most useful facts.'],
  sources: [{ title: trend.title, url: trend.link, publishedAt: trend.publishedAt }],
};

const prompt = buildArticlePrompt(brief);
fs.mkdirSync('data', { recursive: true });
fs.writeFileSync('data/article-brief.json', JSON.stringify({ generatedAt: new Date().toISOString(), brief, prompt }, null, 2));

const placeholder = {
  title: brief.title,
  description: `A researched TrendForge brief about ${brief.title}.`,
  content: `This article is awaiting the configured AI writing provider and editorial review.\n\nThe research brief is ready, but TrendForge will not publish placeholder or invented content.`,
  sources: brief.sources,
};

const gate = editorialGate(placeholder);
fs.writeFileSync('data/editorial-gate.json', JSON.stringify({ passed: gate.passed, checks: gate.checks, generatedAt: new Date().toISOString() }, null, 2));

if (!gate.passed) {
  console.log('Quality gate correctly blocked placeholder content.');
  process.exit(0);
}

const article = { ...placeholder, slug: slugify(brief.title), category: brief.category, generatedAt: new Date().toISOString() };
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(`${outputDir}/${article.slug}.md`, articleToMarkdown(article));
