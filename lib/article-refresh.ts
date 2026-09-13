import type { Article } from '@/lib/articles';

type RefreshLevel = 'fresh' | 'watch' | 'refresh';

export type RefreshReport = {
  ageDays: number;
  level: RefreshLevel;
  score: number;
  reasons: string[];
  actions: string[];
};

const DAY = 86_400_000;

export function getRefreshReport(article: Article, now = new Date()): RefreshReport {
  const published = new Date(article.date);
  const ageDays = Math.max(0, Math.floor((now.getTime() - published.getTime()) / DAY));
  const reasons: string[] = [];
  const actions: string[] = [];
  let score = 100;

  if (ageDays >= 180) {
    score -= 45;
    reasons.push('Article is at least 180 days old.');
    actions.push('Re-check facts, statistics, product details and every cited source.');
  } else if (ageDays >= 90) {
    score -= 25;
    reasons.push('Article is at least 90 days old.');
    actions.push('Review important claims and sources for changes.');
  } else if (ageDays >= 30) {
    score -= 10;
    reasons.push('Article is at least 30 days old.');
    actions.push('Review whether the topic, examples or links still reflect the current landscape.');
  }

  const sourceCount = article.sources.filter((source) => /^https:\/\//i.test(source.url)).length;
  if (sourceCount < 2) {
    score -= 20;
    reasons.push('Fewer than two HTTPS sources are available.');
    actions.push('Add or replace sources with authoritative, current HTTPS references.');
  }

  if (article.content.length < 5) {
    score -= 10;
    reasons.push('The article has limited section depth.');
    actions.push('Consider adding useful sections only where new information materially improves the article.');
  }

  if (reasons.length === 0) {
    reasons.push('No refresh trigger detected by the current rules.');
    actions.push('Keep monitoring the article and refresh it when facts, sources or search performance materially change.');
  }

  const level: RefreshLevel = score < 60 ? 'refresh' : score < 85 ? 'watch' : 'fresh';
  return { ageDays, level, score: Math.max(0, score), reasons, actions };
}

export function getRefreshQueue(articles: Article[], now = new Date()) {
  return articles
    .map((article) => ({ article, report: getRefreshReport(article, now) }))
    .sort((a, b) => a.report.score - b.report.score || b.report.ageDays - a.report.ageDays);
}
