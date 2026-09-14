import fs from 'node:fs';

const scoredPath = 'data/scored-trends.json';
const articlesDir = 'content/articles';
const outputPath = 'data/decision-queue.json';
const memoryPath = 'data/decision-memory.json';
const logPath = 'data/decision-log.jsonl';

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const normalize = (value = '') => value.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
const tokens = (value = '') => new Set(normalize(value).split(' ').filter((word) => word.length >= 4));
const overlap = (a, b) => {
  const left = tokens(a);
  const right = tokens(b);
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  return shared / Math.max(left.size, right.size);
};

const categoryKeywords = {
  AI: ['ai', 'artificial intelligence', 'model', 'agent', 'llm', 'machine learning', 'anthropic', 'openai', 'gemini'],
  Technology: ['android', 'software', 'hardware', 'cloud', 'browser', 'chip', 'platform', 'developer', 'technology'],
  'How-To': ['how to', 'guide', 'steps', 'set up', 'setup', 'update', 'move', 'configure'],
  Innovation: ['research', 'prototype', 'breakthrough', 'innovation', 'scientists', 'lab'],
  'Product Launches': ['launch', 'released', 'release', 'unveils', 'introduces', 'new product'],
  'Digital Life': ['privacy', 'password', 'passkey', 'social', 'consumer', 'online'],
  Crypto: ['bitcoin', 'crypto', 'ethereum', 'blockchain', 'token', 'defi'],
};

function inferCategory(item) {
  if (item.category && Object.prototype.hasOwnProperty.call(categoryKeywords, item.category)) return item.category;
  const text = normalize(`${item.title || ''} ${item.description || ''}`);
  let best = 'Technology';
  let bestHits = 0;
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    const hits = keywords.reduce((count, keyword) => count + (text.includes(keyword) ? 1 : 0), 0);
    if (hits > bestHits) {
      best = category;
      bestHits = hits;
    }
  }
  return best;
}

function loadExistingArticles() {
  if (!fs.existsSync(articlesDir)) return [];
  return fs.readdirSync(articlesDir)
    .filter((name) => name.endsWith('.md'))
    .map((name) => {
      const raw = fs.readFileSync(`${articlesDir}/${name}`, 'utf8');
      const title = raw.match(/^title:\s*"([\s\S]*?)"\s*$/m)?.[1] || name.replace(/\.md$/, '');
      const category = raw.match(/^category:\s*"([\s\S]*?)"\s*$/m)?.[1] || '';
      return { title, category };
    });
}

function loadMemory() {
  if (!fs.existsSync(memoryPath)) return { version: 1, decisions: [], categoryStats: {}, recentTopics: [] };
  try { return JSON.parse(fs.readFileSync(memoryPath, 'utf8')); } catch { return { version: 1, decisions: [], categoryStats: {}, recentTopics: [] }; }
}

function saveMemory(memory) {
  fs.mkdirSync('data', { recursive: true });
  fs.writeFileSync(memoryPath, `${JSON.stringify(memory, null, 2)}\n`);
}

function appendLog(records) {
  fs.mkdirSync('data', { recursive: true });
  fs.appendFileSync(logPath, records.map((record) => JSON.stringify(record)).join('\n') + '\n');
}

if (!fs.existsSync(scoredPath)) {
  console.log(`No ${scoredPath}; decision engine has nothing to evaluate.`);
  process.exit(0);
}

const research = JSON.parse(fs.readFileSync(scoredPath, 'utf8'));
const trends = research.trends ?? [];
const existing = loadExistingArticles();
const memory = loadMemory();
const categoryCounts = Object.fromEntries(Object.keys(categoryKeywords).map((category) => [category, 0]));
for (const article of existing) if (categoryCounts[article.category] !== undefined) categoryCounts[article.category] += 1;

const decisions = trends.map((item, index) => {
  const category = inferCategory(item);
  const sourceCount = Array.isArray(item.sources) ? item.sources.length : (item.source ? 1 : 0);
  const baseScore = clamp(Number(item.score) || 0);
  const freshness = clamp(Number(item.freshnessScore ?? item.freshness ?? 0));
  const sourceConfidence = clamp(sourceCount >= 2 ? 95 : sourceCount === 1 ? 70 : 35);
  const titleDuplicate = existing.find((article) => normalize(article.title) === normalize(item.title));
  const maxSimilarity = existing.reduce((max, article) => Math.max(max, overlap(item.title, article.title)), 0);
  const novelty = clamp(100 - Math.round(maxSimilarity * 100));
  const categoryNeed = categoryCounts[category] === 0 ? 100 : clamp(80 - categoryCounts[category] * 12);
  const eligibility = item.eligible ? 100 : 55;
  const confidence = Math.round(sourceConfidence * 0.45 + freshness * 0.20 + novelty * 0.20 + eligibility * 0.15);
  const decisionScore = Math.round(baseScore * 0.45 + confidence * 0.30 + novelty * 0.15 + categoryNeed * 0.10);

  const reasons = [];
  if (item.eligible) reasons.push('research eligibility passed');
  else reasons.push('research eligibility is not yet proven');
  reasons.push(`${sourceCount} source(s) detected`);
  reasons.push(`topic novelty ${novelty}/100`);
  reasons.push(`source confidence ${sourceConfidence}/100`);
  if (categoryNeed >= 90) reasons.push(`category gap detected: ${category}`);
  if (titleDuplicate) reasons.push('exact title duplicate detected');
  if (maxSimilarity >= 0.55) reasons.push('high title similarity with an existing article');

  let decision = 'hold';
  if (titleDuplicate || maxSimilarity >= 0.75) decision = 'reject';
  else if (decisionScore >= 80 && confidence >= 70) decision = 'publish_candidate';
  else if (decisionScore >= 65 && confidence >= 55) decision = 'review';

  return {
    rank: index + 1,
    link: item.link,
    title: item.title,
    description: item.description || '',
    category,
    sourceCount,
    baseScore,
    confidence,
    novelty,
    categoryNeed,
    decisionScore,
    decision,
    reasons,
  };
});

decisions.sort((a, b) => b.decisionScore - a.decisionScore);
for (const [index, decision] of decisions.entries()) decision.rank = index + 1;

const now = new Date().toISOString();
const queue = {
  version: 1,
  generatedAt: now,
  policy: {
    publishCandidateMinScore: 80,
    reviewMinScore: 65,
    minimumConfidenceForPublishCandidate: 70,
    hardRejectSimilarity: 0.75,
    note: 'Decision engine prioritizes candidates; existing research, quality, duplicate, safety and SEO gates remain authoritative.'
  },
  summary: {
    total: decisions.length,
    publishCandidates: decisions.filter((d) => d.decision === 'publish_candidate').length,
    review: decisions.filter((d) => d.decision === 'review').length,
    hold: decisions.filter((d) => d.decision === 'hold').length,
    reject: decisions.filter((d) => d.decision === 'reject').length,
  },
  decisions,
};

fs.mkdirSync('data', { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(queue, null, 2)}\n`);

const nextMemory = {
  version: 1,
  updatedAt: now,
  decisions: [...memory.decisions, ...decisions.slice(0, 20).map((d) => ({ timestamp: now, title: d.title, category: d.category, decision: d.decision, score: d.decisionScore, confidence: d.confidence }))].slice(-200),
  categoryStats: Object.fromEntries(Object.keys(categoryCounts).map((category) => [category, {
    publishedCount: categoryCounts[category],
    queuedCount: decisions.filter((d) => d.category === category && d.decision === 'publish_candidate').length,
  }])),
  recentTopics: [...new Set([...memory.recentTopics, ...decisions.slice(0, 10).map((d) => normalize(d.title))])].slice(-100),
};
saveMemory(nextMemory);

appendLog(decisions.map((d) => ({
  timestamp: now,
  title: d.title,
  category: d.category,
  decision: d.decision,
  score: d.decisionScore,
  confidence: d.confidence,
  novelty: d.novelty,
  reasons: d.reasons,
})));

console.log(`Decision Engine v1: ${decisions.length} candidate(s) evaluated.`);
console.log(`Decision summary: ${queue.summary.publishCandidates} publish candidate(s), ${queue.summary.review} review, ${queue.summary.hold} hold, ${queue.summary.reject} reject.`);
if (decisions[0]) console.log(`Top decision: ${decisions[0].decision} — ${decisions[0].title} (${decisions[0].decisionScore}/100, confidence ${decisions[0].confidence}/100).`);
