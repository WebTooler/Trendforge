import type { Article } from './articles';
import { seoDescription, seoTitle } from './seo';

type QuerySignal = { query: string; impressions: number; clicks: number; ctr: number; position: number };

export type OptimizationItem = {
  level: 'high' | 'medium' | 'good';
  area: string;
  finding: string;
  action: string;
};

export type OptimizationReport = {
  score: number;
  wordCount: number;
  headingCount: number;
  sourceCount: number;
  seoTitle: string;
  seoDescription: string;
  items: OptimizationItem[];
  opportunities: QuerySignal[];
};

function words(text: string) {
  return text.replace(/[#*_`>\[\]()]/g, ' ').split(/\s+/).filter(Boolean);
}

function clean(text: string) {
  return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function optimizeArticle(article: Article, signals: QuerySignal[] = []): OptimizationReport {
  const body = article.content.join('\n');
  const plain = clean(body);
  const wordCount = words(plain).length;
  const headingCount = article.content.filter((part) => /^##\s+/m.test(part)).length;
  const sourceCount = article.sources.filter((source) => /^https:\/\//.test(source.url)).length;
  const title = seoTitle(article);
  const description = seoDescription(article);
  const items: OptimizationItem[] = [];
  let score = 100;

  if (title.length < 30 || title.length > 70) {
    score -= 15;
    items.push({ level: 'high', area: 'Title', finding: `SEO title is ${title.length} characters.`, action: 'Rewrite toward a clear, specific search intent while staying around 30–70 characters.' });
  } else {
    items.push({ level: 'good', area: 'Title', finding: `SEO title is ${title.length} characters and within the target range.`, action: 'Keep the main topic near the beginning and avoid unnecessary wording.' });
  }

  if (description.length < 50 || description.length > 170) {
    score -= 12;
    items.push({ level: 'high', area: 'Meta description', finding: `Meta description is ${description.length} characters.`, action: 'Rewrite it as a useful 50–170 character summary that matches the search intent.' });
  } else {
    items.push({ level: 'good', area: 'Meta description', finding: `Meta description is ${description.length} characters and within the target range.`, action: 'Keep the benefit and primary topic explicit.' });
  }

  if (wordCount < 150) {
    score -= 20;
    items.push({ level: 'high', area: 'Depth', finding: `Article body contains about ${wordCount} words.`, action: 'Add original explanation, examples, evidence and practical takeaways before publishing.' });
  } else if (wordCount < 500) {
    score -= 8;
    items.push({ level: 'medium', area: 'Depth', finding: `Article body contains about ${wordCount} words.`, action: 'Consider adding useful context or examples if the topic needs more depth; do not pad for word count.' });
  } else {
    items.push({ level: 'good', area: 'Depth', finding: `Article body contains about ${wordCount} words.`, action: 'Preserve substance and remove repetition during future refreshes.' });
  }

  if (headingCount < 3) {
    score -= 12;
    items.push({ level: 'medium', area: 'Structure', finding: `${headingCount} H2 sections detected.`, action: 'Use descriptive H2 sections to break the topic into distinct search intents.' });
  } else {
    items.push({ level: 'good', area: 'Structure', finding: `${headingCount} H2 sections detected.`, action: 'Keep headings descriptive rather than repetitive.' });
  }

  if (sourceCount < 2) {
    score -= 15;
    items.push({ level: 'high', area: 'Evidence', finding: `${sourceCount} HTTPS sources detected.`, action: 'Add authoritative, relevant sources for factual claims.' });
  } else {
    items.push({ level: 'good', area: 'Evidence', finding: `${sourceCount} HTTPS sources detected.`, action: 'Prefer primary or authoritative sources when refreshing claims.' });
  }

  const lower = plain.toLowerCase();
  const titleTerms = words(article.title.toLowerCase()).filter((word) => word.length >= 4);
  const missingTerms = [...new Set(titleTerms)].filter((term) => !lower.includes(term));
  if (missingTerms.length) {
    score -= Math.min(10, missingTerms.length * 2);
    items.push({ level: 'medium', area: 'Topic coverage', finding: `Some title terms are not clearly present in the body: ${missingTerms.slice(0, 5).join(', ')}.`, action: 'Check whether the article actually answers those concepts; add them naturally only when relevant.' });
  } else {
    items.push({ level: 'good', area: 'Topic coverage', finding: 'The main title terms are represented in the article body.', action: 'Keep language natural and avoid keyword stuffing.' });
  }

  const opportunities = signals
    .filter((signal) => signal.query && signal.impressions >= 10 && signal.position >= 4 && signal.position <= 20)
    .sort((a, b) => (b.impressions * Math.max(1, 21 - b.position)) - (a.impressions * Math.max(1, 21 - a.position)))
    .slice(0, 8);

  if (opportunities.length) {
    items.push({ level: 'medium', area: 'Search opportunities', finding: `${opportunities.length} queries show meaningful impressions while ranking between positions 4–20.`, action: 'Review these queries and improve sections that genuinely satisfy their intent; never force unrelated keywords.' });
  } else {
    items.push({ level: 'good', area: 'Search opportunities', finding: 'No ranking-opportunity queries were supplied from Search Console data.', action: 'Export Search Console queries later and upload them here for opportunity analysis.' });
  }

  return { score: Math.max(0, Math.min(100, score)), wordCount, headingCount, sourceCount, seoTitle: title, seoDescription: description, items, opportunities };
}

export function parseSearchConsoleCsv(csv: string): QuerySignal[] {
  const rows = csv.trim().split(/\r?\n/).filter(Boolean);
  if (rows.length < 2) return [];
  const parseLine = (line: string) => line.split(',').map((value) => value.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
  const header = parseLine(rows[0]).map((value) => value.toLowerCase());
  const find = (...names: string[]) => names.map((name) => header.indexOf(name)).find((index) => index >= 0) ?? -1;
  const queryIndex = find('top queries', 'query', 'queries');
  const impressionsIndex = find('impressions');
  const clicksIndex = find('clicks');
  const ctrIndex = find('ctr', 'site ctr');
  const positionIndex = find('position', 'average position');
  if (queryIndex < 0 || impressionsIndex < 0 || clicksIndex < 0 || positionIndex < 0) return [];
  return rows.slice(1).map(parseLine).map((row) => {
    const impressions = Number(row[impressionsIndex]?.replace(/,/g, '')) || 0;
    const clicks = Number(row[clicksIndex]?.replace(/,/g, '')) || 0;
    const rawCtr = row[ctrIndex] ?? '';
    const ctr = Number(rawCtr.replace('%', '')) || (impressions ? clicks / impressions * 100 : 0);
    const position = Number(row[positionIndex]?.replace(/,/g, '')) || 0;
    return { query: row[queryIndex] ?? '', impressions, clicks, ctr, position };
  }).filter((row) => row.query);
}
