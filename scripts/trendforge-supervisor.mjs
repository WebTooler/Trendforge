import fs from 'node:fs';

const DATA = 'data';
const MEMORY_PATH = `${DATA}/trendforge-memory.json`;
const PERFORMANCE_PATH = `${DATA}/trendforge-performance.json`;
const LEARNING_PATH = `${DATA}/trendforge-learning.json`;
const SECURITY_PATH = `${DATA}/trendforge-security-reliability.json`;
const OUTPUT_PATH = `${DATA}/trendforge-supervisor.json`;
const now = new Date().toISOString();

function readJson(path, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(path, 'utf8')); } catch { return fallback; }
}
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
function rate(a, b) { const x = num(a), y = num(b); return y > 0 && x != null ? Math.round((x / y) * 100) : null; }

const memory = readJson(MEMORY_PATH);
if (!memory || !Array.isArray(memory.runs)) throw new Error(`Invalid or missing ${MEMORY_PATH}`);
const performance = readJson(PERFORMANCE_PATH);
const learning = readJson(LEARNING_PATH);
const security = readJson(SECURITY_PATH);
const runs = memory.runs;
const latest = runs.at(-1) ?? {};

const metrics = {
  runs: runs.length,
  topics: Array.isArray(memory.topics) ? memory.topics.length : 0,
  articles: Array.isArray(memory.articles) ? memory.articles.length : 0,
  evidencePassRate: latest.evidence ? rate(latest.evidence.passed, latest.evidence.candidates) : null,
  publishCandidateRate: latest.decisions ? rate(latest.decisions.publishCandidates, latest.decisions.total) : null,
  singleSourceReadyRate: latest.decisions ? rate(latest.decisions.singleSourceVerifiedReady, latest.decisions.total) : null,
  claimConfidence: num(latest.claims?.averageConfidence),
  editorialScore: num(latest.editorial?.averageScore),
};

const bottlenecks = [];
const perfBottlenecks = Array.isArray(performance.bottlenecks) ? performance.bottlenecks : [];
for (const b of perfBottlenecks) bottlenecks.push({ id: b.id ?? 'performance-bottleneck', severity: b.severity ?? 'medium', detail: b.detail ?? 'Performance layer reported a bottleneck.' });

const providerIssues = [];
for (const [name, p] of Object.entries(performance.providers ?? {})) {
  if ((num(p.successRate) ?? 100) < 10 || num(p.cooldownRuns) > 0) {
    providerIssues.push({ provider: name, successRate: p.successRate ?? null, cooldownRuns: p.cooldownRuns ?? 0 });
  }
}

const recommendations = [];
const addRecommendation = (action, reason, priority = 'medium') => recommendations.push({ action, reason, priority });

if ((metrics.evidencePassRate ?? 100) < 20) addRecommendation('RECOVER_SOURCE', 'Validated publisher evidence is reaching fewer than 20% of research candidates.', 'high');
if (providerIssues.length) addRecommendation('RECOVER_PROVIDER', `${providerIssues.length} AI provider(s) show low historical success or cooldown activity.`, 'high');
if ((metrics.publishCandidateRate ?? 100) === 0 && runs.length > 0) addRecommendation('HOLD_AND_DIAGNOSE', 'No current research candidates are direct publish candidates; preserve publication gates and diagnose upstream evidence/decision constraints.', 'high');
if ((metrics.claimConfidence ?? 100) < 60) addRecommendation('REPAIR_GROUNDING', 'Latest claim confidence is below the existing claim-verification pass line; use the existing grounding repair/reverification path.', 'high');
if ((metrics.editorialScore ?? 100) < 70 && metrics.articles > 0) addRecommendation('REVIEW_EDITORIAL', 'Recent editorial score is below the internal observation line.', 'medium');
if (!recommendations.length) addRecommendation('CONTINUE_OBSERVATION', 'No high-priority operational bottleneck was detected by the available telemetry.', 'low');

const phaseHealth = {
  research: metrics.topics > 0 ? 'observed' : 'unknown',
  evidence: metrics.evidencePassRate == null ? 'unknown' : metrics.evidencePassRate >= 20 ? 'healthy' : 'attention',
  decision: latest.decisions ? 'observed' : 'unknown',
  claims: metrics.claimConfidence == null ? 'unknown' : metrics.claimConfidence >= 60 ? 'healthy' : 'attention',
  editorial: metrics.editorialScore == null ? 'unknown' : metrics.editorialScore >= 70 ? 'healthy' : 'attention',
  security: security?.checks?.every?.((c) => c.ok) || security?.passed === true ? 'healthy' : security?.checks ? 'attention' : 'unknown',
};

const overall = recommendations.some(r => r.priority === 'high') ? 'attention' : recommendations.some(r => r.priority === 'medium') ? 'watch' : 'healthy';

const output = {
  version: 1,
  updatedAt: now,
  mode: 'advisory-observational',
  overall,
  policy: {
    observationalOnly: true,
    influencesDecisions: false,
    changesPublicationGates: false,
    changesEvidenceThresholds: false,
    changesClaimThresholds: false,
    changesSafetyGates: false,
    autoRewriteArticle: false,
    autoDeleteArticle: false,
    autoPublish: false,
    maxActionsPerRun: 3,
  },
  phaseHealth,
  metrics,
  bottlenecks: bottlenecks.slice(0, 20),
  providerIssues,
  recommendations: recommendations.slice(0, 3),
  source: {
    memoryRuns: runs.length,
    performanceVersion: performance.version ?? null,
    learningVersion: learning.version ?? null,
    securityVersion: security.version ?? null,
  },
};

fs.mkdirSync(DATA, { recursive: true });
fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`);
console.log(`TrendForge Supervisor v1: ${overall.toUpperCase()} — ${output.bottlenecks.length} bottleneck(s), ${output.recommendations.length} recommendation(s).`);
console.log('Mode: ADVISORY-OBSERVATIONAL — Supervisor cannot change publication, evidence, claim, editorial, or safety gates.');
console.log(`Supervisor output: ${OUTPUT_PATH}`);
