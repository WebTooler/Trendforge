import type { Article } from '@/lib/articles';

export type RelatedArticle = Pick<Article, 'slug' | 'title' | 'category' | 'description'>;

function tokens(value: string) {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length >= 4),
  );
}

/**
 * Finds related articles without hard-coded article-to-article links.
 * Category match is the strongest signal; shared meaningful title/description
 * terms provide a lightweight relevance signal as the library grows.
 */
export function getRelatedArticles(current: Article, all: Article[], limit = 3): RelatedArticle[] {
  const currentTokens = tokens(`${current.title} ${current.description}`);

  return all
    .filter((article) => article.slug !== current.slug)
    .map((article) => {
      const articleTokens = tokens(`${article.title} ${article.description}`);
      let score = article.category.toLowerCase() === current.category.toLowerCase() ? 10 : 0;
      for (const token of articleTokens) {
        if (currentTokens.has(token)) score += 1;
      }
      return { article, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || b.article.date.localeCompare(a.article.date))
    .slice(0, limit)
    .map(({ article }) => ({
      slug: article.slug,
      title: article.title,
      category: article.category,
      description: article.description,
    }));
}
