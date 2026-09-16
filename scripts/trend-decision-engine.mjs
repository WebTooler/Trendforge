import fs from 'node:fs';

const scoredPath = 'data/scored-trends.json';
const verificationPath = 'data/source-verification.json';
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
      const publishedAt = raw.match(/^publishedAt:\s*"([\s\S]*?)"\s*$/m)?.[1] || '';
      return { title, category, publishedAt };
    });
}

function loadMemory() {
  if (!fs.existsSync(memoryPath)) return { version: 1, decisions: [], categoryStats: {}, recentTopics: [] };
  try { return JSON.parse(fs.readFileSync(memoryPath, 'utf8')); } catch { return { version: 1, decisions: [], categoryStats: {}, recentTopics: [] }; }
}

function loadSourceVerification() {
  if (!fs.existsSync(verificationPath)) return new Map();
  try {
    const payload = JSON.parse(fs.readFileSync(verificationPath, 'utf8'));
    return new Map((payload.records ?? []).map((record) => [record.link, record]));
  } catch {
    return new Map();
  }
}

function saveMemory(memory) {
  fs.mkdirSync('data', { recursive: true });
  fs.writeFileSync(memoryPath, `${JSON.stringify(memory, null, 2)}\n`);
}

function appendLog(records) {
  fs.mkdirSync('data', { recursive: true });
  const existing = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8').trim().split('\n').filter(Boolean) : [];
  const next = [...existing, ...records.map((record) => JSON.stringify(record))].slice(-1000);
  fs.writeFileSync(logPath, next.length ? `${next.join('\n')}\n` : '');
}

if (!fs.existsSync(scoredPath)) {
  console.log(`No ${scoredPath}; decision engine has nothing to evaluate.`);
  process.exit(0);
}

const research = JSON.parse(fs.readFileSync(scoredPath, 'utf8'));
const trends = research.trends ?? [];
const verificationByLink = loadSourceVerification();
const existing = loadExistingArticles();
const memory = loadMemory();
const categoryCounts = Object.fromEntries(Object.keys(categoryKeywords).map((category) => [category, 0]));
for (const article of existing) if (categoryCounts[article.category] !== undefined) categoryCounts[article.category] += 1;
const totalPublished = Math.max(1, existing.length);
const recentCategories = existing
  .map((article) => ({ category: article.category, time: new Date(article.publishedAt).getTime() || 0 }))
  .sort((a, b) => b.time - a.time)
  .slice(0, 3)
  .map((item) => item.category);

const decisions = trends.map((item, index) => {
  const category = inferCategory(item);
  const verification = verificationByLink.get(item.link);
  const originalSourceCount = Array.isArray(item.sources) && item.sources.length
    ? item.sources.length
    : (item.sourceName || item.source || item.sourceUrl ? 1 : 0);
  const reachableSourceCount = Number(verification?.relevantReachableSourceCount ?? verification?.reachableSourceCount ?? 0);
  const discoveredSourceCount = Number(verification?.discoveredSourceCount ?? 0);
  const independentDomainCount = Number(verification?.independentPublisherCount ?? verification?.uniqueDomainCount ?? 0);
  const sourceCount = verification
    ? Math.max(originalSourceCount, reachableSourceCount)
    : originalSourceCount;
  const baseScore = clamp(Number(item.score) || 0);
  const ageHours = Number.isFinite(new Date(item.publishedAt).getTime())
    ? Math.max(0, (Date.now() - new Date(item.publishedAt).getTime()) / 36e5)
    : 9999;
  const freshness = clamp(ageHours <= 6 ? 100 : ageHours <= 24 ? 80 : ageHours <= 72 ? 48 : ageHours <= 168 ? 20 : 0);
  const originalSourceConfidence = clamp(originalSourceCount >= 2 ? 95 : originalSourceCount === 1 ? 70 : 35);
  const evidenceConfidence = verification
    ? clamp(Number(verification.confidence) || 0)
    : originalSourceConfidence;
  const sourceConfidence = verification
    ? Math.max(originalSourceConfidence, evidenceConfidence)
    : originalSourceConfidence;
  const evidenceReady = independentDomainCount >= 2 && reachableSourceCount >= 2;
  const titleDuplicate = existing.find((article) => normalize(article.title) === normalize(item.title));
  const maxSimilarity = existing.reduce((max, article) => Math.max(max, overlap(item.title, article.title)), 0);
  const novelty = clamp(100 - Math.round(maxSimilarity * 100));
  const categoryNeed = categoryCounts[category] === 0 ? 100 : clamp(80 - categoryCounts[category] * 12);
  const eligibility = item.eligible ? 100 : 55;
  const confidence = Math.round(sourceConfidence * 0.45 + freshness * 0.20 + novelty * 0.20 + eligibility * 0.15);
  const decisionScore = Math.round(baseScore * 0.45 + confidence * 0.30 + novelty * 0.15 + categoryNeed * 0.10);

  const categoryShare = categoryCounts[category] / totalPublished;
  const balanceBonus = categoryShare < 0.10 ? 8 : categoryShare > 0.35 ? -8 : 0;
  const recentPenalty = recentCategories[0] === category ? 12 : recentCategories.includes(category) ? 5 : 0;
  const adaptivePriority = clamp(decisionScore + (categoryNeed >= 90 ? 8 : 0) + balanceBonus - recentPenalty);

  const reasons = [];
  if (item.eligible) reasons.push('research eligibility passed');
  else reasons.push('research eligibility is not yet proven');
  reasons.push(`${sourceCount} source(s) detected`);
  if (verification) {
    reasons.push(`evidence verification: ${reachableSourceCount} relevant reachable source(s), ${independentDomainCount} independent publisher family/families`);
    if (discoveredSourceCount > 0) reasons.push(`${discoveredSourceCount} discovered publisher source(s) available`);
    if (evidenceReady) reasons.push('multi-source evidence ready');
    else reasons.push('multi-source evidence not yet proven');
  }
  reasons.push(`topic freshness ${freshness}/100`);
  reasons.push(`topic novelty ${novelty}/100`);
  reasons.push(`source confidence ${sourceConfidence}/100`);
  if (categoryNeed >= 90) reasons.push(`category gap detected: ${category}`);
  if (balanceBonus > 0) reasons.push(`underrepresented category bonus +${balanceBonus}`);
  if (balanceBonus < 0) reasons.push(`overrepresented category adjustment ${balanceBonus}`);
  if (recentPenalty > 0) reasons.push(`recent category penalty -${recentPenalty}`);
  if (titleDuplicate) reasons.push('exact title duplicate detected');
  if (maxSimilarity >= 0.55) reasons.push('high title similarity with an existing article');

  let decision = 'hold';
  if (titleDuplicate || maxSimilarity >= 0.75) decision = 'reject';
  else if (decisionScore >= 80 && confidence >= 70 && (!verification || evidenceReady)) decision = 'publish_candidate';
  else if (decisionScore >= 65 && confidence >= 55) decision = 'review';

  return {
    rank: index + 1,
    link: item.link,
    title: item.title,
    description: item.description || '',
    category,
    sourceCount,
    originalSourceCount,
    reachableSourceCount,
    discoveredSourceCount,
    independentDomainCount,
    evidenceReady,
    baseScore,
    confidence,
    novelty,
    categoryNeed,
    decisionScore,
    adaptivePriority,
    decision,
    reasons,
  };
});

decisions.sort((a, b) => b.adaptivePriority - a.adaptivePriority || b.decisionScore - a.decisionScore);
for (const [index, decision] of decisions.entries()) decision.rank = index + 1;

const now = new Date().toISOString();
const queue = {
  version: 3,
  generatedAt: now,
  evidenceIntegrated: verificationByLink.size > 0,
  policy: {
    publishCandidateMinScore: 80,
    reviewMinScore: 65,
    minimumConfidenceForPublishCandidate: 70,
    minimumIndependentDomainsForPublishCandidate: 2,
    minimumReachableSourcesForPublishCandidate: 2,
    hardRejectSimilarity: 0.75,
    adaptiveCategoryBalance: true,
    recentCategoryPenalty: true,
    note: 'Decision engine consumes verified, candidate-scoped evidence when available. Existing research, writer, quality, duplicate, safety and SEO gates remain authoritative.'
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
  decisions: [...memory.decisions, ...decisions.slice(0, 20).map((d) => ({ timestamp: now, title: d.title, category: d.category, decision: d.decision, score: d.decisionScore, adaptivePriority: d.adaptivePriority, confidence: d.confidence }))].slice(-200),
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
  adaptivePriority: d.adaptivePriority,
  confidence: d.confidence,
  novelty: d.novelty,
  evidenceReady: d.evidenceReady,
  reachableSourceCount: d.reachableSourceCount,
  discoveredSourceCount: d.discoveredSourceCount,
  independentDomainCount: d.independentDomainCount,
  reasons: d.reasons,
})));

console.log(`Decision Engine v4: ${decisions.length} candidate(s) evaluated; evidence integration ${verificationByLink.size ? 'active' : 'fallback-only'}.`);
console.log(`Decision summary: ${queue.summary.publishCandidates} publish candidate(s), ${queue.summary.review} review, ${queue.summary.hold} hold, ${queue.summary.reject} reject.`);
console.log(`Decision evidence: ${decisions.filter((d) => d.evidenceReady).length} candidate(s) have >=2 relevant reachable sources across >=2 independent publisher families.`);
if (decisions[0]) console.log(`Top adaptive decision: ${decisions[0].decision} — ${decisions[0].title} (${decisions[0].adaptivePriority}/100 priority, decision ${decisions[0].decisionScore}/100, confidence ${decisions[0].confidence}/100).`);
