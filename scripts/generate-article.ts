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

const stopWords = new Set(['about','after','again','also','been','being','could','from','have','into','more','most','over','said','some','than','that','their','there','these','they','this','what','when','which','with','will','would','your','technology','tech','digital','latest','news','update','updates','guide','how','today','artificial','intelligence','company','companies']);
const topicWords = (text = '') => new Set(text.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length >= 4 && !stopWords.has(word)));

// Google News uses one generic feed label, so recover the actual publisher from its RSS description when possible.
const publisherName = (item: Trend) => {
  const explicit = (item.sourceName || item.source || '').trim();
  if (explicit && explicit.toLowerCase() !== 'google news') return explicit;
  const match = item.description?.match(/<font[^>]*>([^<]+)<\/font>/i);
  return match?.[1]?.trim() || explicit || 'Unknown publisher';
};

const blockedPublishers = new Set(['facebook.com', 'facebook', 'reddit', 'pinterest', 'youtube', 'tiktok', 'x.com']);
const isCrediblePublisher = (name: string) => {
  const normalized = name.toLowerCase().trim();
  return normalized && !blockedPublishers.has(normalized) && !normalized.includes('facebook.com');
};

async function main() {
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

  const eligible = trends
    .filter((item) => item.eligible && !existingTitles.has(item.title.toLowerCase().trim()))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const trend = eligible.find((candidate) => {
    const publisherA = publisherName(candidate);
    if (!isCrediblePublisher(publisherA)) return false;
    const words = topicWords(`${candidate.title} ${candidate.description ?? ''}`);
    return eligible.some((item) => {
      if (item === candidate || item.link === candidate.link || item.category !== candidate.category) return false;
      const publisherB = publisherName(item);
      if (!isCrediblePublisher(publisherB) || publisherA.toLowerCase() === publisherB.toLowerCase()) return false;
      const titleOverlap = [...topicWords(item.title)].filter((word) => words.has(word)).length;
      const descriptionOverlap = [...topicWords(item.description ?? '')].filter((word) => words.has(word)).length;
      // Require either two meaningful shared topic terms or one strong title term plus contextual overlap.
      return titleOverlap >= 2 || (titleOverlap >= 1 && descriptionOverlap >= 2);
    });
  });

  if (!trend) { console.log('No new eligible trend with independent credible source coverage found.'); process.exit(0); }

  const publisherA = publisherName(trend);
  const words = topicWords(`${trend.title} ${trend.description ?? ''}`);
  const related = eligible.find((item) => {
    if (item === trend || item.link === trend.link || item.category !== trend.category) return false;
    const publisherB = publisherName(item);
    if (!isCrediblePublisher(publisherB) || publisherA.toLowerCase() === publisherB.toLowerCase()) return false;
    const titleOverlap = [...topicWords(item.title)].filter((word) => words.has(word)).length;
    const descriptionOverlap = [...topicWords(item.description ?? '')].filter((word) => words.has(word)).length;
    return titleOverlap >= 2 || (titleOverlap >= 1 && descriptionOverlap >= 2);
  });

  if (!related) { console.log('No second independent publisher found for this topic; publication blocked.'); process.exit(0); }

  const brief: ArticleBrief = {
    title: trend.title,
    category: trend.category,
    angle: 'Explain what changed, why it matters, what is known versus uncertain, and what readers should watch next. Use the supplied sources as factual references only; write an original synthesis.',
    keyPoints: [trend.description ?? 'Use only verified source context.', related.description ?? 'Cross-check the development against the second independent publisher.'],
    sources: [
      { title: `${publisherA}: ${trend.title}`, url: trend.link, publishedAt: trend.publishedAt },
      { title: `${publisherName(related)}: ${related.title}`, url: related.link, publishedAt: related.publishedAt },
    ],
  };

  const prompt = buildArticlePrompt(brief);
  fs.mkdirSync('data', { recursive: true });
  fs.writeFileSync('data/article-brief.json', JSON.stringify({ generatedAt: new Date().toISOString(), brief, prompt }, null, 2));

  if (!process.env.OPENAI_API_KEY) {
    console.log('OPENAI_API_KEY is not configured. Brief created; publishing blocked.');
    process.exit(0);
  }

  let response: Response;
  try {
    response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-5.6-luna',
        input: `${prompt}\n\nReturn ONLY valid JSON with keys: title, description, content. Content must be at least 1200 words, contain useful H2 headings, and be an original synthesis. Do not reproduce source sentences, paragraphs, or headlines. Do not invent facts, quotes, statistics, dates, or capabilities.`,
      }),
    });
  } catch (error) {
    console.log(`OpenAI request could not be completed: ${error instanceof Error ? error.message : String(error)}. Publishing blocked.`);
    process.exit(0);
  }

  if (!response.ok) {
    const body = await response.text();
    console.log(`OpenAI API returned ${response.status}: ${body.slice(0, 1000)}. Publishing blocked.`);
    process.exit(0);
  }

  const result = await response.json() as {
    output_text?: string;
    output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
  };

  const outputText = result.output_text || result.output
    ?.flatMap((item) => item.content ?? [])
    .filter((item) => item.type === 'output_text' && item.text)
    .map((item) => item.text)
    .join('') || '';

  if (!outputText.trim()) {
    console.log('OpenAI returned no usable text. Publishing blocked.');
    process.exit(0);
  }

  let generated: { title: string; description: string; content: string };
  try {
    const cleaned = outputText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    generated = JSON.parse(cleaned);
  } catch {
    console.log('AI output was not valid JSON; publishing blocked.');
    process.exit(0);
  }

  if (!generated.title?.trim() || !generated.description?.trim() || !generated.content?.trim()) {
    console.log('AI output is missing required article fields; publishing blocked.');
    process.exit(0);
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
}

main().catch((error) => {
  console.error(`Generator failed unexpectedly: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
