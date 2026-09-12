import fs from 'node:fs';
import { articleToMarkdown, buildArticlePrompt, editorialGate, slugify, type ArticleBrief } from '../lib/article-engine';
import { copyrightSafetyGate } from '../lib/copyright-safety';

type Trend = {
  title: string;
  link: string;
  source: string;
  sourceName?: string;
  publishedAt?: string;
  category: string;
  description?: string;
  eligible?: boolean;
  score?: number;
};

const input = 'data/scored-trends.json';
const outputDir = 'content/articles';
if (!fs.existsSync(input)) process.exit(0);

const payload = JSON.parse(fs.readFileSync(input, 'utf8')) as { trends?: Trend[] };
const trends = payload.trends ?? [];
const existingTitles = new Set<string>();
if (fs.existsSync(outputDir)) {
  for (const file of fs.readdirSync(outputDir).filter((name) => name.endsWith('.md'))) {
    const raw = fs.readFileSync(`${outputDir}/${file}`, 'utf8');
    const title = raw.match(/^title:\s*"([\s\S]*?)"\s*$/m)?.[1];
    if (title) existingTitles.add(title.toLowerCase().trim());
  }
}

const stopWords = new Set(['about','after','again','also','been','being','could','from','have','into','more','most','over','said','some','than','that','their','there','these','they','this','what','when','which','with','will','would','your','technology','tech','digital','latest','news','update','updates','guide','how','today','artificial','intelligence']);
const topicWords = (title: string) => new Set(title.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length >= 4 && !stopWords.has(word)));

const trend = trends.find((item) => item.eligible && !existingTitles.has(item.title.toLowerCase().trim()));
if (!trend) { console.log('No new eligible trend found.'); process.exit(0); }

const words = topicWords(trend.title);
const related = trends.find((item) => {
  if (!item.eligible || item.link === trend.link || item.category !== trend.category) return false;
  const publisherA = (trend.sourceName || trend.source || '').toLowerCase().trim();
  const publisherB = (item.sourceName || item.source || '').toLowerCase().trim();
  if (!publisherA || !publisherB || publisherA === publisherB) return false;
  const overlap = [...topicWords(item.title)].filter((word) => words.has(word)).length;
  return overlap >= 2;
});

if (!related) { console.log('No second independent publisher found for this topic; publication blocked.'); process.exit(0); }

const brief: ArticleBrief = {
  title: trend.title,
  category: trend.category,
  angle: 'Explain what changed, why it matters, what is known versus uncertain, and what readers should watch next. Use the supplied sources as factual references only; write an original synthesis.',
  keyPoints: [trend.description ?? 'Use only verified source context.', related.description ?? 'Cross-check the development against the second independent publisher.'],
  sources: [
    { title: `${trend.sourceName || trend.source}: ${trend.title}`, url: trend.link, publishedAt: trend.publishedAt },
    { title: `${related.sourceName || related.source}: ${related.title}`, url: related.link, publishedAt: related.publishedAt },
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
    input: `${prompt}\n\nReturn ONLY valid JSON with keys: title, description, content. Content must be at least 1200 words, contain useful H2 headings, and be an original synthesis. Do not reproduce source sentences, paragraphs, or headlines. Do not invent facts, quotes, statistics, dates, or capabilities.`,
  }),
});
if (!response.ok) throw new Error(`OpenAI API error: ${response.status} ${await response.text()}`);
const result = await response.json() as { output_text?: string };
if (!result.output_text) throw new Error('OpenAI returned no output text.');

let generated: { title: string; description: string; content: string };
try {
  generated = JSON.parse(result.output_text);
} catch {
  throw new Error('AI output was not valid JSON; publishing blocked.');
}

if (!generated.title?.trim() || !generated.description?.trim() || !generated.content?.trim()) {
  throw new Error('AI output is missing required article fields; publishing blocked.');
}
if (existingTitles.has(generated.title.toLowerCase().trim())) {
  console.log('Generated title already exists; publication blocked.');
  process.exit(0);
}

const article = { ...generated, slug: slugify(generated.title), category: brief.category, sources: brief.sources, generatedAt: new Date().toISOString() };
const editorial = editorialGate(article);
const copyright = copyrightSafetyGate({ content: article.content, sources: article.sources.map((s) => s.url), images: [] });
const checks = { editorial, copyright };
fs.writeFileSync('data/editorial-gate.json', JSON.stringify({ generatedAt: new Date().toISOString(), ...checks }, null, 2));
if (!editorial.passed || !copyright.passed) { console.log('Quality/copyright gate blocked publication.'); process.exit(0); }

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(`${outputDir}/${article.slug}.md`, articleToMarkdown(article));
console.log(`Published article draft: ${article.slug}`);
