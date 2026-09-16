'use client';

import { useEffect, useMemo, useState } from 'react';
import { trackEvent } from '@/lib/analytics';

type SearchArticle = {
  slug: string;
  title: string;
  description: string;
  category: string;
  date: string;
  readTime: string;
  content: string;
};

const basePath = '/Trendforge';
const MAX_QUERY_LENGTH = 100;

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokens(value: string) {
  return normalize(value).split(' ').filter((term) => term.length >= 2);
}

function score(article: SearchArticle, rawQuery: string) {
  const query = normalize(rawQuery).slice(0, MAX_QUERY_LENGTH);
  const terms = tokens(query);
  if (!terms.length) return 0;
  const title = normalize(article.title);
  const description = normalize(article.description);
  const category = normalize(article.category);
  const content = normalize(article.content);
  let total = 0;
  if (title === query) total += 60;
  if (title.includes(query)) total += 30;
  for (const term of terms) {
    if (title.split(' ').includes(term)) total += 14;
    else if (title.includes(term)) total += 8;
    if (category.includes(term)) total += 9;
    if (description.includes(term)) total += 6;
    if (content.includes(term)) total += 2;
  }
  const daysOld = Math.max(0, (Date.now() - new Date(article.date).getTime()) / 86400000);
  if (Number.isFinite(daysOld)) total += Math.max(0, 10 - Math.min(10, daysOld / 30));
  return total;
}

export default function SearchBox() {
  const [articles, setArticles] = useState<SearchArticle[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${basePath}/search-index.json`)
      .then((response) => {
        if (!response.ok) throw new Error('Search index unavailable');
        return response.json() as Promise<SearchArticle[]>;
      })
      .then(setArticles)
      .catch(() => setArticles([]))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => ['All', ...Array.from(new Set(articles.map((article) => article.category))).sort()], [articles]);

  const results = useMemo(() => {
    const normalizedQuery = normalize(query).slice(0, MAX_QUERY_LENGTH);
    return articles
      .filter((article) => category === 'All' || article.category === category)
      .map((article) => ({ article, score: normalizedQuery ? score(article, normalizedQuery) : 1 }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || b.article.date.localeCompare(a.article.date))
      .map(({ article }) => article);
  }, [articles, category, query]);

  useEffect(() => {
    const normalizedQuery = normalize(query).slice(0, MAX_QUERY_LENGTH);
    if (!normalizedQuery || loading) return;
    const timer = window.setTimeout(() => {
      trackEvent('search', { query: normalizedQuery, category, results: results.length });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [query, category, results.length, loading]);

  function handleResultClick(article: SearchArticle) {
    trackEvent('search_result_click', {
      query: normalize(query).slice(0, MAX_QUERY_LENGTH),
      category: article.category,
      slug: article.slug,
    });
  }

  return <section className="search-panel" aria-labelledby="search-heading">
    <div className="search-controls">
      <label className="search-input-wrap">
        <span className="sr-only">Search articles</span>
        <input value={query} onChange={(event) => setQuery(event.target.value.slice(0, MAX_QUERY_LENGTH))} placeholder="Search AI, technology, guides..." type="search" autoComplete="off" maxLength={MAX_QUERY_LENGTH} />
      </label>
      <label className="search-filter">
        <span className="sr-only">Filter by category</span>
        <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter by category">
          {categories.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>
    </div>

    <div className="search-summary" id="search-heading" aria-live="polite">
      {loading ? 'Loading stories...' : query ? `${results.length} ${results.length === 1 ? 'story' : 'stories'} found` : `${results.length} ${results.length === 1 ? 'story' : 'stories'} available`}
    </div>

    {!loading && results.length > 0 ? <div className="search-results">
      {results.map((article) => <article className="search-result" key={article.slug}>
        <div className="tag">{article.category} · {article.readTime}</div>
        <h2><a href={`${basePath}/article/${article.slug}/`} onClick={() => handleResultClick(article)}>{article.title}</a></h2>
        <p>{article.description}</p>
        <a className="read-button" href={`${basePath}/article/${article.slug}/`} onClick={() => handleResultClick(article)}>Read story <span>→</span></a>
      </article>)}
    </div> : !loading ? <div className="search-empty"><h2>No matching stories</h2><p>Try a broader keyword or switch the category filter.</p></div> : null}
  </section>;
}
