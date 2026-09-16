import fs from 'node:fs';

const DATA = 'data';
const MEMORY_PATH = `${DATA}/trendforge-memory.json`;
const LEARNING_PATH = `${DATA}/trendforge-learning.json`;
const EXPERIMENT_PATH = `${DATA}/trendforge-experiments.json`;
const OUTPUT_PATH = `${DATA}/trendforge-performance.json`;
const now = new Date().toISOString();

function readJson(path, fallback = null) {
  try { return JSON.parse(fs.readFileSync(path, 'utf8')); } catch { return fallback; }
}
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
function avg(values) { const a = values.map(num).filter(v => v != null); return a.length ? Math.round(a.reduce((x,y)=>x+y,0)/a.length) : null; }
function rate(a,b) { const x=num(a), y=num(b); return y>0 && x!=null ? Math.round(x/y*100) : null; }
function delta(a,b) { return a != null && b != null ? a-b : null; }

const memory = readJson(MEMORY_PATH);
if (!memory || typeof memory !== 'object') throw new Error(`Invalid or missing ${MEMORY_PATH}`);
const learning = readJson(LEARNING_PATH, {});
const experiments = readJson(EXPERIMENT_PATH, {});
const runs = Array.isArray(memory.runs) ? memory.runs : [];
const articles = Array.isArray(memory.articles) ? memory.articles : [];

const latest = runs.at(-1) ?? null;
const previous = runs.length > 1 ? runs.at(-2) : null;
const latestEditorial = num(latest?.editorial?.averageScore);
const previousEditorial = num(previous?.editorial?.averageScore);
const latestClaim = num(latest?.claims?.averageConfidence);
const previousClaim = num(previous?.claims?.averageConfidence);
const latestEvidencePass = rate(latest?.evidence?.passed, latest?.evidence?.candidates);
const previousEvidencePass = rate(previous?.evidence?.passed, previous?.evidence?.candidates);

const providerStats = {};
for (const [name, p] of Object.entries(learning.providers ?? {})) {
  const successes = num(p.successes) ?? 0;
  const failures = num(p.failures) ?? 0;
  providerStats[name] = {
    successRate: rate(successes, successes + failures),
    successes,
    failures,
    cooldownRuns: num(p.cooldownRuns) ?? 0,
    latestStatus: p.latestStatus ?? null,
    latestClass: p.latestClass ?? null,
  };
}

const categoryStats = {};
for (const [category, c] of Object.entries(learning.categories ?? {})) {
  categoryStats[category] = {
    topicSamples: num(c.topicSamples) ?? 0,
    averageScore: num(c.averageScore),
    averageConfidence: num(c.averageConfidence),
    evidenceLevels: c.evidenceLevels ?? {},
    decisions: c.decisions ?? {},
  };
}

const metrics = {
  runCount: runs.length,
  topicCount: Array.isArray(memory.topics) ? memory.topics.length : 0,
  articleCount: articles.length,
  latestEditorialScore: latestEditorial,
  latestClaimConfidence: latestClaim,
  latestEvidencePassRate: latestEvidencePass,
  latestEvidenceBlockRate: rate(latest?.evidence?.blocked, latest?.evidence?.candidates),
  singleSourceReadyRate: rate(latest?.decisions?.singleSourceVerifiedReady, latest?.decisions?.total),
  publishCandidateRate: rate(latest?.decisions?.publishCandidates, latest?.decisions?.total),
};

const changes = {
  editorialScore: delta(latestEditorial, previousEditorial),
  claimConfidence: delta(latestClaim, previousClaim),
  evidencePassRate: delta(latestEvidencePass, previousEvidencePass),
};

const bottlenecks = [];
if ((metrics.latestEvidencePassRate ?? 0) < 20) bottlenecks.push({ id:'evidence-throughput', severity:'high', detail:'Validated evidence is reaching only a minority of research candidates.' });
if ((metrics.publishCandidateRate ?? 0) === 0) bottlenecks.push({ id:'publish-eligibility', severity:'high', detail:'No research candidates are currently classified as direct publish candidates.' });
if ((metrics.articleCount ?? 0) > 0 && (metrics.latestEditorialScore ?? 100) < 70) bottlenecks.push({ id:'editorial-quality', severity:'medium', detail:'Recent editorial score is below the internal 70-point observation line.' });
for (const [name,p] of Object.entries(providerStats)) {
  if ((p.successRate ?? 100) < 10 || p.cooldownRuns > 0) bottlenecks.push({ id:`provider-${name.toLowerCase()}`, severity:'medium', detail:`Provider ${name} has low historical success or cooldown activity.` });
}

const insights = [];
if (runs.length < 5) insights.push({ id:'small-history', type:'data-quality', confidence:'low', detail:'Performance observations are based on fewer than 5 historical runs; treat trends as provisional.' });
if (changes.editorialScore != null) insights.push({ id:'editorial-trend', type:'trend', confidence:runs.length>=5?'medium':'low', detail:`Average editorial score changed by ${changes.editorialScore >= 0 ? '+' : ''}${changes.editorialScore} points versus the previous run.` });
if (changes.claimConfidence != null) insights.push({ id:'claim-trend', type:'trend', confidence:runs.length>=5?'medium':'low', detail:`Average claim confidence changed by ${changes.claimConfidence >= 0 ? '+' : ''}${changes.claimConfidence} points versus the previous run.` });
if (changes.evidencePassRate != null) insights.push({ id:'evidence-trend', type:'trend', confidence:runs.length>=5?'medium':'low', detail:`Evidence pass rate changed by ${changes.evidencePassRate >= 0 ? '+' : ''}${changes.evidencePassRate} percentage points versus the previous run.` });
if (bottlenecks.length) insights.push({ id:'current-bottlenecks', type:'bottleneck', confidence:runs.length>=5?'medium':'low', detail:`${bottlenecks.length} operational bottleneck(s) observed; this is diagnostic only and does not change gates.` });

const next = {
  version: 1,
  updatedAt: now,
  mode: 'shadow',
  policy: {
    observationalOnly: true,
    influencesDecisions: false,
    changesPublicationGates: false,
    changesEvidenceThresholds: false,
    changesClaimThresholds: false,
    changesSafetyGates: false,
    minimumPerformanceRuns: 5,
  },
  metrics,
  changes,
  providers: providerStats,
  categories: categoryStats,
  bottlenecks,
  insights,
  experimentSummary: {
    registered: Array.isArray(experiments.experiments) ? experiments.experiments.length : 0,
    assignments: Array.isArray(experiments.assignments) ? experiments.assignments.length : 0,
    mode: experiments.mode ?? 'unknown',
  },
  source: {
    memoryRuns: runs.length,
    learningVersion: learning.version ?? null,
    experimentationVersion: experiments.version ?? null,
  },
};

fs.mkdirSync(DATA, { recursive:true });
fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(next,null,2)}\n`);
console.log(`TrendForge Performance Intelligence v1: ${runs.length} run(s), ${articles.length} article(s), ${bottlenecks.length} bottleneck(s), ${insights.length} insight(s).`);
console.log('Mode: SHADOW — performance intelligence is diagnostic only and cannot change publication, evidence, claim, or safety gates.');
console.log(`Performance output: ${OUTPUT_PATH}`);
