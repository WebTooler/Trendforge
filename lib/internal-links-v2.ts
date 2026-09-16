import type { Article } from '@/lib/articles';

export type RelatedArticle = Pick<Article, 'slug' | 'title' | 'category' | 'description'>;

const stopWords = new Set(['about','after','again','also','been','being','between','could','from','have','into','more','most','other','over','same','some','than','that','their','there','these','they','this','through','what','when','where','which','while','with','your']);

function tokens(value: string) {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length >= 4 && !stopWords.has(word)),
  );
}

export function getRelatedArticles(current: Article, all: Article[], limit = 3): RelatedArticle[] {
  const currentTokens = tokens(`${current.title} ${current.description}`);
  const candidates = all
    .filter((article) => article.slug !== current.slug)
    .map((article) => {
      const articleTokens = tokens(`${article.title} ${article.description}`);
      let score = 0;
      if (article.category.toLowerCase() === current.category.toLowerCase()) score += 30;
      for (const token of articleTokens) if (currentTokens.has(token)) score += 3;
      const freshness = Number.isFinite(new Date(article.publishedAt || article.date).getTime())
        ? new Date(article.publishedAt || article.date).getTime() / 1e13
        : 0;
      return { article, score, freshness };
    })
    .sort((a, b) => b.score - a.score || b.freshness - a.freshness)
    .slice(0, limit);

  // Never leave an article isolated simply because the corpus is still small.
  // If semantic/category matching is weak, use the newest eligible stories as
  // a deterministic discovery fallback.
  if (candidates.length < limit) {
    const selected = new Set(candidates.map(({ article }) => article.slug));
    const fallback = all
      .filter((article) => article.slug !== current.slug && !selected.has(article.slug))
      .sort((a, b) => (b.publishedAt || b.date).localeCompare(a.publishedAt || a.date));
    for (const article of fallback) {
      if (candidates.length >= limit) break;
      candidates.push({ article, score: 0, freshness: 0 });
    }
  }

  return candidates.map(({ article }) => ({
    slug: article.slug,
    title: article.title,
    category: article.category,
    description: article.description,
  }));
}
