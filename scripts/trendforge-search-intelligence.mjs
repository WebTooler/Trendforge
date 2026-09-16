export const searchIntelligencePolicy = Object.freeze({
  version: 1,
  mode: 'observational-ranking',
  index: 'public/search-index.json',
  ranking: ['exact_title', 'title_terms', 'category', 'description', 'content', 'freshness'],
  minTermLength: 2,
  maxQueryLength: 100,
  changesPublicationGates: false,
  changesThresholds: false,
  changesResearch: false,
  changesEvidence: false,
  changesWriter: false,
  changesEditorial: false,
  changesClaimVerification: false,
  changesSafety: false,
});

export function normalizeSearch(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function tokenizeSearch(value) {
  return normalizeSearch(value).split(' ').filter((term) => term.length >= searchIntelligencePolicy.minTermLength);
}

export function rankSearchArticle(article, query) {
  const normalizedQuery = normalizeSearch(query).slice(0, searchIntelligencePolicy.maxQueryLength);
  const terms = tokenizeSearch(normalizedQuery);
  if (!terms.length) return 0;
  const title = normalizeSearch(article.title);
  const description = normalizeSearch(article.description);
  const category = normalizeSearch(article.category);
  const content = normalizeSearch(article.content);
  let score = 0;
  if (title === normalizedQuery) score += 60;
  if (title.includes(normalizedQuery)) score += 30;
  for (const term of terms) {
    if (title.split(' ').includes(term)) score += 14;
    else if (title.includes(term)) score += 8;
    if (category.includes(term)) score += 9;
    if (description.includes(term)) score += 6;
    if (content.includes(term)) score += 2;
  }
  // Freshness is a tie-breaker among relevant results, never a reason to
  // surface an article that has no textual relevance to the query.
  if (score > 0) {
    const daysOld = Math.max(0, (Date.now() - new Date(article.date).getTime()) / 86400000);
    if (Number.isFinite(daysOld)) score += Math.max(0, 10 - Math.min(10, daysOld / 30));
  }
  return score;
}

export function rankSearchResults(articles, query, category = 'All') {
  const normalizedQuery = normalizeSearch(query);
  return articles
    .filter((article) => category === 'All' || article.category === category)
    .map((article) => ({ article, score: normalizedQuery ? rankSearchArticle(article, normalizedQuery) : 1 }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || String(b.article.date).localeCompare(String(a.article.date)))
    .map(({ article }) => article);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(`TrendForge Search Intelligence v${searchIntelligencePolicy.version}: ${searchIntelligencePolicy.mode}`);
  console.log('Search ranking is isolated from publication decisions and thresholds.');
}
