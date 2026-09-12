import fs from 'node:fs';
import { articleToMarkdown, buildArticlePrompt, editorialGate, slugify, type ArticleBrief } from '../lib/article-engine';
import { copyrightSafetyGate } from '../lib/copyright-safety';

type Trend = { title: string; link: string; source: string; publishedAt?: string; category: string; description?: string; eligible?: boolean; score?: number };
const input = 'data/scored-trends.json';
const outputDir = 'content/articles';
if (!fs.existsSync(input)) process.exit(0);

const payload = JSON.parse(fs.readFileSync(input, 'utf8')) as { trends?: Trend[] };
const trends = payload.trends ?? [];
const trend = trends.find((item) => item.eligible);
if (!trend) { console.log('No eligible trend found.'); process.exit(0); }

const words = new Set(trend.title.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 4));
const related = trends.find((item) => item.eligible && item.link !== trend.link && item.category === trend.category && [...new Set(item.title.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 4))].some(w => words.has(w)));
if (!related) { console.log('No second independent source found for this topic; publication blocked.'); process.exit(0); }

const brief: ArticleBrief = {
  title: trend.title,
  category: trend.category,
  angle: 'Explain what changed, why it matters, what is known versus uncertain, and what readers should watch next. Use the supplied sources as factual references only; write an original synthesis.',
  keyPoints: [trend.description ?? 'Use only verified source context.', related.description ?? 'Cross-check the development against the second source.'],
  sources: [
    { title: trend.title, url: trend.link, publishedAt: trend.publishedAt },
    { title: related.title, url: related.link, publishedAt: related.publishedAt },
  ],
};

const prompt = buildArticlePrompt(brief);
fs.mkdirSync('data', { recursive: true });
fs.writeFileSync('data/article-brief.json', JSON.stringify({ generatedAt: new Date().toISOString(), brief, prompt }, null, 2));

if (!process.env.OPENAI_API_KEY) { console.log('OPENAI_API_KEY is not configured. Brief created; publishing blocked.'); process.exit(0); }

const response = await fetch('https://api.openai.com/v1/responses', {
  method: 'POST',
  headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: process.env.OPENAI_MODEL || 'gpt-5.6-luna',
    input: `${prompt}\n\nReturn ONLY valid JSON with keys: title, description, content. Content must be at least 1200 words, contain useful H2 headings, and be an original synthesis. Do not reproduce source sentences or paragraphs.`,
  }),
});
if (!response.ok) throw new Error(`OpenAI API error: ${response.status} ${await response.text()}`);
const result = await response.json() as { output_text?: string };
if (!result.output_text) throw new Error('OpenAI returned no output text.');

let generated: { title: string; description: string; content: string };
try { generated = JSON.parse(result.output_text); } catch { throw new Error('AI output was not valid JSON; publishing blocked.'); }

const article = { ...generated, slug: slugify(generated.title), category: brief.category, sources: brief.sources, generatedAt: new Date().toISOString() };
const editorial = editorialGate(article);
const copyright = copyrightSafetyGate({ content: article.content, sources: article.sources.map((s) => s.url), images: [] });
const checks = { editorial, copyright };
fs.writeFileSync('data/editorial-gate.json', JSON.stringify({ generatedAt: new Date().toISOString(), ...checks }, null, 2));
if (!editorial.passed || !copyright.passed) { console.log('Quality/copyright gate blocked publication.'); process.exit(0); }

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(`${outputDir}/${article.slug}.md`, articleToMarkdown(article));
console.log(`Published article draft: ${article.slug}`);
