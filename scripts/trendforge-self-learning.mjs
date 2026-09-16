import fs from 'node:fs';

const DATA = 'data';
const MEMORY_PATH = `${DATA}/trendforge-memory.json`;
const LEARNING_PATH = `${DATA}/trendforge-learning.json`;
const now = new Date().toISOString();

function readJson(path, fallback = null) {
  try { return JSON.parse(fs.readFileSync(path, 'utf8')); }
  catch { return fallback; }
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function avg(values) {
  const valid = values.map(num).filter((v) => v != null);
  return valid.length ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : null;
}

function rate(success, total) {
  const s = num(success);
  const t = num(total);
  return t > 0 && s != null ? Math.round((s / t) * 100) : null;
}

function safeName(value) {
  return String(value ?? '').trim().toLowerCase();
}

const memory = readJson(MEMORY_PATH);
if (!memory || typeof memory !== 'object') throw new Error(`Invalid or missing ${MEMORY_PATH}`);

const runs = Array.isArray(memory.runs) ? memory.runs : [];
const topics = Array.isArray(memory.topics) ? memory.topics : [];

const decisionTotals = runs.reduce((acc, run) => {
  const d = run?.decisions;
  if (!d) return acc;
  for (const key of ['total', 'publishCandidates', 'review', 'hold', 'reject', 'strongEvidenceReady', 'singleSourceVerifiedReady']) {
    acc[key] = (acc[key] ?? 0) + (num(d[key]) ?? 0);
  }
  acc.samples += 1;
  return acc;
}, { samples: 0 });

const evidenceTotals = runs.reduce((acc, run) => {
  const e = run?.evidence;
  if (!e) return acc;
  for (const key of ['candidates', 'passed', 'blocked', 'strong', 'singleSource']) {
    acc[key] = (acc[key] ?? 0) + (num(e[key]) ?? 0);
  }
  acc.samples += 1;
  return acc;
}, { samples: 0 });

const claimRuns = runs.map((run) => run?.claims).filter(Boolean);
const claimLearning = {
  samples: claimRuns.length,
  passRate: claimRuns.length ? rate(claimRuns.filter((c) => c.pass).length, claimRuns.length) : null,
  averageConfidence: avg(claimRuns.map((c) => c.averageConfidence)),
  averageUnsupported: avg(claimRuns.map((c) => c.unsupported)),
  averageClaimsPerArticle: avg(claimRuns.map((c) => c.claimCount)),
};

const providerNames = new Set();
for (const run of runs) for (const name of Object.keys(run?.providers ?? {})) providerNames.add(name);
const providers = {};
for (const name of [...providerNames].sort()) {
  const samples = runs.map((run) => run?.providers?.[name]).filter(Boolean);
  const successes = samples.reduce((sum, p) => sum + (num(p.successes) ?? 0), 0);
  const failures = samples.reduce((sum, p) => sum + (num(p.failures) ?? 0), 0);
  providers[name] = {
    samples: samples.length,
    successes,
    failures,
    successRate: rate(successes, successes + failures),
    cooldownRuns: samples.filter((p) => p.inCooldown).length,
    latestStatus: samples.at(-1)?.lastStatus ?? null,
    latestClass: samples.at(-1)?.lastClass ?? null,
  };
}

const categoryBuckets = new Map();
for (const topic of topics) {
  const category = String(topic.category || 'Unknown').trim() || 'Unknown';
  if (!categoryBuckets.has(category)) categoryBuckets.set(category, []);
  categoryBuckets.get(category).push(topic);
}
const categories = Object.fromEntries([...categoryBuckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([category, items]) => ({
  [category]: {
    topicSamples: items.length,
    averageScore: avg(items.map((t) => t.score)),
    averageConfidence: avg(items.map((t) => t.confidence)),
    evidenceLevels: items.reduce((acc, t) => {
      const key = t.evidenceLevel ?? 'none';
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
    decisions: items.reduce((acc, t) => {
      const key = t.decision ?? 'unknown';
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  },
})));

const learningSignals = [];
if (evidenceTotals.samples > 0) {
  learningSignals.push({
    id: 'evidence-single-source-dominance',
    observation: evidenceTotals.singleSource > evidenceTotals.strong,
    detail: 'Historical evidence currently contains more single-source candidates than strong multi-source candidates.',
    sampleRuns: evidenceTotals.samples,
    confidence: evidenceTotals.samples >= 5 ? 'medium' : 'low',
  });
}
if (claimRuns.length > 0) {
  learningSignals.push({
    id: 'claim-verification-pressure',
    observation: (claimLearning.averageUnsupported ?? 0) > 0,
    detail: 'Claim-verification history contains unsupported claims in at least some observed article runs.',
    sampleRuns: claimRuns.length,
    confidence: claimRuns.length >= 5 ? 'medium' : 'low',
  });
}
if (Object.keys(providers).length) {
  learningSignals.push({
    id: 'provider-reliability-signal',
    observation: true,
    detail: 'Provider success/failure and cooldown history is available for future reliability learning.',
    sampleRuns: runs.length,
    confidence: runs.length >= 5 ? 'medium' : 'low',
  });
}

const previous = readJson(LEARNING_PATH, {});
const next = {
  version: 1,
  updatedAt: now,
  mode: 'shadow',
  policy: {
    advisoryOnly: true,
    influencesDecisions: false,
    changesPublicationGates: false,
    changesEvidenceThresholds: false,
    changesClaimThresholds: false,
    minimumLearningRuns: 5,
  },
  sample: {
    runs: runs.length,
    topics: topics.length,
    articles: Array.isArray(memory.articles) ? memory.articles.length : 0,
  },
  decisions: {
    samples: decisionTotals.samples,
    publishCandidateRate: rate(decisionTotals.publishCandidates, decisionTotals.total),
    reviewRate: rate(decisionTotals.review, decisionTotals.total),
    holdRate: rate(decisionTotals.hold, decisionTotals.total),
    rejectRate: rate(decisionTotals.reject, decisionTotals.total),
    strongEvidenceRate: rate(decisionTotals.strongEvidenceReady, decisionTotals.total),
    singleSourceReadyRate: rate(decisionTotals.singleSourceVerifiedReady, decisionTotals.total),
  },
  evidence: {
    samples: evidenceTotals.samples,
    passRate: rate(evidenceTotals.passed, evidenceTotals.candidates),
    blockRate: rate(evidenceTotals.blocked, evidenceTotals.candidates),
    strongRate: rate(evidenceTotals.strong, evidenceTotals.candidates),
    singleSourceRate: rate(evidenceTotals.singleSource, evidenceTotals.candidates),
  },
  claims: claimLearning,
  providers,
  categories,
  signals: learningSignals,
  history: {
    previousUpdatedAt: previous.updatedAt ?? null,
    previousVersion: previous.version ?? null,
  },
};

fs.mkdirSync(DATA, { recursive: true });
fs.writeFileSync(LEARNING_PATH, `${JSON.stringify(next, null, 2)}\n`);
console.log(`TrendForge Self-Learning v1: ${runs.length} run(s), ${topics.length} topic(s), ${claimRuns.length} claim sample(s).`);
console.log('Mode: SHADOW — learning is advisory only and cannot change publication, evidence, claim, editorial, safety, or monetization gates.');
console.log(`Learning output: ${LEARNING_PATH}`);
