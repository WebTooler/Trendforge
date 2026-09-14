export type TrendCandidate = {
  title: string;
  link: string;
  source: string;
  publishedAt: string;
  category: string;
  description?: string;
};

export type ScoredTrend = TrendCandidate & {
  score: number;
  reasons: string[];
  eligible: boolean;
};

const KEYWORDS: Record<string, string[]> = {
  AI: ['ai', 'artificial intelligence', 'model', 'agent', 'chatgpt', 'gemini', 'copilot'],
  Technology: ['technology', 'chip', 'semiconductor', 'software', 'apple', 'google', 'microsoft', 'meta'],
  'Digital Life': ['privacy', 'security', 'app', 'social media', 'smartphone', 'internet'],
  'How-To': ['how to', 'guide', 'tutorial', 'tips', 'explained', 'setup', 'set up'],
  Innovation: ['innovation', 'breakthrough', 'invention', 'discovery', 'research', 'prototype', 'new technology'],
  'Product Launches': ['launch', 'launched', 'unveils', 'unveiled', 'announces', 'announced', 'release', 'released', 'new product', 'device'],
  Crypto: ['crypto', 'bitcoin', 'ethereum', 'blockchain', 'stablecoin', 'defi', 'token', 'web3'],
};

function keywordScore(title: string, category: string): number {
  const text = title.toLowerCase();
  const matches = (KEYWORDS[category] ?? []).filter((word) => text.includes(word));
  return Math.min(25, matches.length * 6);
}

function recencyScore(publishedAt: string): number {
  const ageHours = Math.max(0, (Date.now() - new Date(publishedAt).getTime()) / 36e5);
  if (ageHours <= 6) return 25;
  if (ageHours <= 24) return 20;
  if (ageHours <= 72) return 12;
  if (ageHours <= 168) return 5;
  return 0;
}

export function scoreTrend(candidate: TrendCandidate, sourceCount = 1): ScoredTrend {
  const reasons: string[] = [];
  let score = 0;

  const recency = recencyScore(candidate.publishedAt);
  score += recency;
  if (recency >= 20) reasons.push('Fresh topic');

  const relevance = keywordScore(candidate.title, candidate.category);
  score += relevance;
  if (relevance > 0) reasons.push('Strong category relevance');

  const sourceBonus = Math.min(20, Math.max(0, sourceCount - 1) * 7);
  score += sourceBonus;
  if (sourceBonus > 0) reasons.push('Covered by multiple sources');

  if ((candidate.description ?? '').length >= 80) {
    score += 10;
    reasons.push('Enough context for original synthesis');
  }

  if (candidate.link.startsWith('https://')) score += 10;

  const eligible = score >= 45 && Boolean(candidate.title.trim()) && Boolean(candidate.link);
  return { ...candidate, score: Math.min(100, score), reasons, eligible };
}

export function editorialGate(article: { title: string; description: string; content: string; sources: string[] }) {
  const checks = {
    title: article.title.trim().length >= 20 && article.title.trim().length <= 110,
    description: article.description.trim().length >= 80,
    content: article.content.trim().length >= 900,
    sources: article.sources.length >= 2 && article.sources.every((url) => url.startsWith('https://')),
  };
  const passed = Object.values(checks).every(Boolean);
  return { passed, checks };
}
