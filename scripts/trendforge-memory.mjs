import fs from 'node:fs';

const DATA = 'data';
const MEMORY_PATH = `${DATA}/trendforge-memory.json`;
const now = new Date().toISOString();

function readJson(name, fallback = null) {
  try { return JSON.parse(fs.readFileSync(`${DATA}/${name}`, 'utf8')); }
  catch { return fallback; }
}

function clamp(value, min = 0, max = 100) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : null;
}

function providerSnapshot(state) {
  const providers = state?.providers ?? {};
  return Object.fromEntries(Object.entries(providers).map(([name, p]) => [name, {
    failures: Number(p?.failures ?? 0),
    successes: Number(p?.successes ?? 0),
    lastStatus: p?.lastStatus ?? null,
    lastClass: p?.lastClass ?? null,
    inCooldown: Number(p?.quotaBlockedUntil ?? 0) > Date.now(),
  }]));
}

function articleCatalog() {
  const dir = 'content/articles';
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((file) => file.endsWith('.md')).map((file) => {
    const raw = fs.readFileSync(`${dir}/${file}`, 'utf8');
    const pick = (key) => raw.match(new RegExp(`^${key}:\\s*"([\\s\\S]*?)"\\s*$`, 'm'))?.[1] ?? '';
    return { file, title: pick('title'), category: pick('category'), publishedAt: pick('publishedAt') };
  });
}

const previous = readJson('trendforge-memory.json', {
  version: 1,
  runs: [],
  topics: [],
  articles: [],
  categories: {},
  sources: {},
});

const queue = readJson('decision-queue.json', {});
const evidence = readJson('evidence-integrity.json', {});
const claims = readJson('claim-verification.json', {});
const editorial = readJson('editorial-scores.json', {});
const lifecycle = readJson('article-lifecycle.json', {});
const growth = readJson('growth-intelligence.json', {});
const distribution = readJson('distribution-intelligence.json', {});
const monetization = readJson('monetization-readiness.json', {});
const providerState = readJson('ai-provider-state.json', {});
const decisionMemory = readJson('decision-memory.json', {});

const run = {
  recordedAt: now,
  workflowRun: process.env.GITHUB_RUN_ID ?? null,
  workflowSha: process.env.GITHUB_SHA ?? null,
  decisions: queue.summary ? {
    total: Number(queue.summary.total ?? 0),
    publishCandidates: Number(queue.summary.publishCandidates ?? 0),
    review: Number(queue.summary.review ?? 0),
    hold: Number(queue.summary.hold ?? 0),
    reject: Number(queue.summary.reject ?? 0),
    strongEvidenceReady: Number(queue.summary.strongEvidenceReady ?? 0),
    singleSourceVerifiedReady: Number(queue.summary.singleSourceVerifiedReady ?? 0),
  } : null,
  evidence: evidence.report ? {
    candidates: evidence.report.length,
    passed: evidence.report.filter((r) => r.status === 'pass').length,
    blocked: evidence.report.filter((r) => r.status === 'block').length,
    strong: evidence.report.filter((r) => r.evidenceLevel === 'strong').length,
    singleSource: evidence.report.filter((r) => r.evidenceLevel === 'single-source').length,
  } : null,
  claims: claims.claimCount != null ? {
    title: claims.articleTitle ?? null,
    claimCount: Number(claims.claimCount ?? 0),
    verified: Number(claims.verified ?? 0),
    partial: Number(claims.partial ?? 0),
    unsupported: Number(claims.unsupported ?? 0),
    averageConfidence: clamp(claims.averageConfidence),
    pass: Boolean(claims.pass),
  } : null,
  editorial: editorial.status ? {
    status: editorial.status,
    articleCount: Array.isArray(editorial.articles) ? editorial.articles.length : 0,
    averageScore: Array.isArray(editorial.articles) && editorial.articles.length
      ? Math.round(editorial.articles.reduce((sum, a) => sum + Number(a.score ?? 0), 0) / editorial.articles.length)
      : null,
  } : null,
  lifecycle: lifecycle.summary ?? null,
  growth: growth.summary ?? null,
  distribution: distribution.summary ?? null,
  monetization: monetization.readyForAdSenseFoundation != null
    ? { readyForAdSenseFoundation: Boolean(monetization.readyForAdSenseFoundation) }
    : null,
  providers: providerSnapshot(providerState),
};

const topics = Array.isArray(queue.decisions) ? queue.decisions.slice(0, 50).map((d) => ({
  key: String(d.link || d.title || '').trim(),
  title: d.title ?? '',
  category: d.category ?? '',
  lastSeenAt: now,
  decision: d.decision ?? null,
  score: clamp(d.decisionScore),
  confidence: clamp(d.confidence),
  evidenceLevel: d.evidenceLevel ?? 'none',
})) : [];

const topicMap = new Map((previous.topics ?? []).map((t) => [t.key, t]));
for (const topic of topics) topicMap.set(topic.key, { ...topicMap.get(topic.key), ...topic });

const articles = articleCatalog();
const categoryCounts = {};
for (const article of articles) categoryCounts[article.category || 'Unknown'] = (categoryCounts[article.category || 'Unknown'] || 0) + 1;

const next = {
  version: 1,
  updatedAt: now,
  policy: {
    recordsOperationalHistory: true,
    influencesDecisions: false,
    storesSecrets: false,
    maxRuns: 120,
    maxTopics: 500,
    maxArticles: 500,
  },
  runs: [...(previous.runs ?? []), run].slice(-120),
  topics: [...topicMap.values()].slice(-500),
  articles: articles.slice(-500),
  categories: categoryCounts,
  sources: {
    evidenceCandidates: Number(run.evidence?.candidates ?? 0),
    passed: Number(run.evidence?.passed ?? 0),
    blocked: Number(run.evidence?.blocked ?? 0),
    strong: Number(run.evidence?.strong ?? 0),
    singleSource: Number(run.evidence?.singleSource ?? 0),
  },
  decisionMemory: {
    records: Array.isArray(decisionMemory.decisions) ? decisionMemory.decisions.length : 0,
    updatedAt: decisionMemory.updatedAt ?? null,
  },
};

fs.mkdirSync(DATA, { recursive: true });
fs.writeFileSync(MEMORY_PATH, `${JSON.stringify(next, null, 2)}\n`);
console.log(`TrendForge Memory v1: recorded run ${run.workflowRun ?? 'local'}; ${next.topics.length} topics, ${next.articles.length} articles retained.`);
console.log(`Memory is observational only: it does not alter evidence, claim, editorial, safety, or publication gates.`);
