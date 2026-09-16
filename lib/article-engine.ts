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
  author?: string;
  image?: string;
  imageAlt?: string;
  imageSource?: string;
  imageLicense?: string;
  imageGeneratedBy?: string;
};

export function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90);
}

export function buildArticlePrompt(brief: ArticleBrief): string {
  return [
    'Write an original English-language editorial article for TrendForge.',
    'Do not copy, paraphrase sentence-by-sentence, or imitate any source article.',
    'Synthesize the supplied facts and explain why they matter, but keep the evidence boundary hard: the supplied evidence is the only source of factual premises.',
    'Use clear H2 sections, short paragraphs, and useful editorial context where appropriate.',
    'Do not invent facts, quotes, statistics, dates, product capabilities, sources, motives, causes, outcomes, comparisons, or future developments.',
    'Every checkable factual claim must be directly traceable to the supplied evidence. Preserve attribution when the source is expressing a person or publisher opinion.',
    'Editorial analysis, implications, and recommendations are allowed only when clearly framed as analysis or advice and when they do not introduce a new factual premise. Do not turn an inference into a fact.',
    'A 400-900 word fully grounded article is acceptable. When the evidence is rich, expand by covering additional supported details, attributed statements, context explicitly present in the evidence, and clearly labeled implications—not by adding outside knowledge or filler.',
    'Prefer a complete 500-800 word article when the evidence supports it, but never pad solely to hit a word target.',
    'Return clean article prose with Markdown H2 headings (## Heading). Do not return HTML tags.',
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
  const headings = (article.content.match(/(^|\n)#{2}\s+/g) || []).length + (article.content.match(/<h2\b/gi) || []).length;
  const suspicious = /<script\b|<iframe\b|javascript\s*:/i.test(article.content);
  const checks = {
    title: article.title.trim().length >= 20 && article.title.trim().length <= 110,
    description: article.description.trim().length >= 80 && article.description.trim().length <= 320,
    content: normalized.length >= 900 && words >= 150,
    structure: headings >= 2,
    sources: article.sources.length >= 1 && article.sources.every((source) => /^https:\/\//.test(source.url)),
    noUnsafeMarkup: !suspicious,
  };
  const passed = Object.values(checks).every(Boolean);
  return { passed, checks };
}

export function articleToMarkdown(article: GeneratedArticle): string {
  const safeTitle = article.title.replace(/"/g, '\\"').replace(/\r?\n/g, ' ');
  const safeDescription = article.description.replace(/"/g, '\\"').replace(/\r?\n/g, ' ');
  const safeAuthor = (article.author || 'Tejendra Pal Singh').replace(/"/g, '\\"').replace(/\r?\n/g, ' ');
  const imageFields = article.image
    ? `image: "${article.image.replace(/"/g, '\\"')}"\nimageAlt: "${(article.imageAlt || article.title).replace(/"/g, '\\"')}"\nimageSource: "${(article.imageSource || '').replace(/"/g, '\\"')}"\nimageLicense: "${(article.imageLicense || '').replace(/"/g, '\\"')}"\nimageGeneratedBy: "${(article.imageGeneratedBy || '').replace(/"/g, '\\"')}"\n`
    : '';
  const sourceList = article.sources.map((s) => `- [${s.title}](${s.url})`).join('\n');
  return `---\ntitle: "${safeTitle}"\ndescription: "${safeDescription}"\nslug: "${article.slug}"\ncategory: "${article.category}"\nauthor: "${safeAuthor}"\npublishedAt: "${article.generatedAt}"\n${imageFields}---\n\n${article.content.trim()}\n\n## Sources\n\n${sourceList}\n`;
}
