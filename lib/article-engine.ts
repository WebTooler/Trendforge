export type ArticleBrief = {
  title: string;
  category: string;
  angle: string;
  keyPoints: string[];
  sources: { title: string; url: string; publishedAt?: string }[];
};

export type GeneratedArticle = {
  title: string;
  description: string;
  slug: string;
  category: string;
  content: string;
  sources: { title: string; url: string }[];
  generatedAt: string;
};

export function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90);
}

export function buildArticlePrompt(brief: ArticleBrief): string {
  return [
    'Write an original English-language editorial article for TrendForge.',
    'Do not copy, paraphrase sentence-by-sentence, or imitate any source article.',
    'Synthesize the supplied facts, explain why they matter, and add useful context.',
    'Use clear H2 sections, short paragraphs, and practical takeaways where appropriate.',
    'Do not invent facts, quotes, statistics, dates, product capabilities, or sources.',
    'Every factual claim that depends on the supplied sources must be traceable to them.',
    `Title: ${brief.title}`,
    `Category: ${brief.category}`,
    `Editorial angle: ${brief.angle}`,
    `Key points:\n- ${brief.keyPoints.join('\n- ')}`,
    `Sources:\n${brief.sources.map((s) => `- ${s.title}: ${s.url}`).join('\n')}`,
  ].join('\n\n');
}

export function editorialGate(article: { title: string; description: string; content: string; sources: { url: string }[] }) {
  const normalized = article.content.replace(/\s+/g, ' ').trim();
  const words = normalized.split(/\s+/).filter(Boolean).length;
  const headings = (article.content.match(/(^|\n)#{2}\s+/g) || []).length;
  const checks = {
    title: article.title.trim().length >= 20 && article.title.trim().length <= 110,
    description: article.description.trim().length >= 80 && article.description.trim().length <= 320,
    content: normalized.length >= 900 && words >= 150,
    structure: headings >= 2 || /<h2\b/i.test(article.content),
    sources: article.sources.length >= 2 && article.sources.every((source) => /^https:\/\//.test(source.url)),
  };
  const passed = Object.values(checks).every(Boolean);
  return { passed, checks };
}

export function articleToMarkdown(article: GeneratedArticle): string {
  const safeTitle = article.title.replace(/"/g, '\\"').replace(/\r?\n/g, ' ');
  const safeDescription = article.description.replace(/"/g, '\\"').replace(/\r?\n/g, ' ');
  const sourceList = article.sources.map((s) => `- [${s.title}](${s.url})`).join('\n');
  return `---\ntitle: "${safeTitle}"\ndescription: "${safeDescription}"\nslug: "${article.slug}"\ncategory: "${article.category}"\npublishedAt: "${article.generatedAt}"\n---\n\n${article.content.trim()}\n\n## Sources\n\n${sourceList}\n`;
}
