import fs from 'node:fs';

const DATA = 'data';
const MEMORY_PATH = `${DATA}/trendforge-memory.json`;
const SUPERVISOR_PATH = `${DATA}/trendforge-supervisor.json`;
const PERFORMANCE_PATH = `${DATA}/trendforge-performance.json`;
const LEARNING_PATH = `${DATA}/trendforge-learning.json`;
const SECURITY_PATH = `${DATA}/trendforge-security-reliability.json`;
const OUTPUT_PATH = `${DATA}/trendforge-audit-trail.json`;
const now = new Date().toISOString();

function readJson(path, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(path, 'utf8')); } catch { return fallback; }
}
function safeString(value, max = 500) {
  if (value == null) return null;
  return String(value).replace(/[\r\n\t]+/g, ' ').slice(0, max);
}
function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

const memory = readJson(MEMORY_PATH);
if (!memory || !Array.isArray(memory.runs)) throw new Error(`Invalid or missing ${MEMORY_PATH}`);
const supervisor = readJson(SUPERVISOR_PATH);
const performance = readJson(PERFORMANCE_PATH);
const learning = readJson(LEARNING_PATH);
const security = readJson(SECURITY_PATH);
const runs = memory.runs;

const events = [];
const add = (type, phase, status, details = {}) => events.push({
  id: `audit-${events.length + 1}`,
  recordedAt: safeString(details.recordedAt) ?? now,
  type,
  phase,
  status,
  workflowRun: safeString(details.workflowRun, 80),
  details: Object.fromEntries(Object.entries(details)
    .filter(([k]) => k !== 'recordedAt' && k !== 'workflowRun')
    .map(([k, v]) => [k, typeof v === 'string' ? safeString(v) : v])),
});

for (const run of runs.slice(-120)) {
  const runId = run.workflowRun;
  if (run.decisions) add('decision-summary', 'Decision Engine', 'recorded', {
    recordedAt: run.recordedAt, workflowRun: runId,
    total: safeNumber(run.decisions.total), publishCandidates: safeNumber(run.decisions.publishCandidates),
    review: safeNumber(run.decisions.review), hold: safeNumber(run.decisions.hold), reject: safeNumber(run.decisions.reject),
    evidenceReady: safeNumber(run.decisions.strongEvidenceReady), singleSourceReady: safeNumber(run.decisions.singleSourceVerifiedReady),
  });
  if (run.evidence) add('evidence-summary', 'Research + Fact Verification', run.evidence.blocked > 0 ? 'attention' : 'recorded', {
    recordedAt: run.recordedAt, workflowRun: runId,
    candidates: safeNumber(run.evidence.candidates), passed: safeNumber(run.evidence.passed), blocked: safeNumber(run.evidence.blocked),
    strong: safeNumber(run.evidence.strong), singleSource: safeNumber(run.evidence.singleSource),
  });
  if (run.claims) add('claim-verification', 'Claim Verification', run.claims.pass ? 'pass' : 'block', {
    recordedAt: run.recordedAt, workflowRun: runId,
    claimCount: safeNumber(run.claims.claimCount), verified: safeNumber(run.claims.verified), partial: safeNumber(run.claims.partial),
    unsupported: safeNumber(run.claims.unsupported), averageConfidence: safeNumber(run.claims.averageConfidence),
  });
  if (run.editorial) add('editorial-result', 'Editorial Intelligence', run.editorial.status ?? 'recorded', {
    recordedAt: run.recordedAt, workflowRun: runId,
    articleCount: safeNumber(run.editorial.articleCount), averageScore: safeNumber(run.editorial.averageScore),
  });
  if (run.providers) add('provider-state', 'Provider Intelligence', 'recorded', { recordedAt: run.recordedAt, workflowRun: runId, providers: run.providers });
}

if (supervisor?.overall) add('supervisor-snapshot', 'TrendForge Supervisor', supervisor.overall, {
  recordedAt: supervisor.updatedAt,
  bottleneckCount: Array.isArray(supervisor.bottlenecks) ? supervisor.bottlenecks.length : 0,
  recommendations: Array.isArray(supervisor.recommendations) ? supervisor.recommendations.map(r => r.action).slice(0, 3) : [],
});
if (performance?.version != null) add('performance-snapshot', 'Performance Intelligence', 'recorded', {
  recordedAt: performance.updatedAt, bottleneckCount: Array.isArray(performance.bottlenecks) ? performance.bottlenecks.length : 0,
  insightCount: Array.isArray(performance.insights) ? performance.insights.length : 0,
});
if (learning?.version != null) add('learning-snapshot', 'Self-Learning', 'recorded', { recordedAt: learning.updatedAt, version: learning.version });
if (security?.version != null) add('security-snapshot', 'Security + Reliability', security.passed === true ? 'pass' : 'recorded', { recordedAt: security.updatedAt, version: security.version });

const previous = readJson(OUTPUT_PATH, null);
const previousEvents = Array.isArray(previous?.events) ? previous.events : [];
const merged = [...previousEvents, ...events];
const dedupe = new Map();
for (const event of merged) dedupe.set(`${event.type}|${event.workflowRun ?? ''}|${event.recordedAt}|${event.phase}`, event);
const bounded = [...dedupe.values()].slice(-1000);

const output = {
  version: 1,
  updatedAt: now,
  mode: 'append-only-observational',
  policy: {
    recordsEvents: true,
    storesSecrets: false,
    influencesDecisions: false,
    changesPublicationGates: false,
    changesEvidenceThresholds: false,
    changesClaimThresholds: false,
    changesSafetyGates: false,
    autoRewriteArticle: false,
    autoDeleteArticle: false,
    autoPublish: false,
    maxEvents: 1000,
  },
  eventCount: bounded.length,
  events: bounded,
  sources: {
    memoryRuns: runs.length,
    supervisorVersion: supervisor.version ?? null,
    performanceVersion: performance.version ?? null,
    learningVersion: learning.version ?? null,
    securityVersion: security.version ?? null,
  },
};

fs.mkdirSync(DATA, { recursive: true });
fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`);
console.log(`TrendForge Complete Audit Trail v1: ${bounded.length} event(s) retained.`);
console.log('Mode: APPEND-ONLY-OBSERVATIONAL — audit trail cannot change publishing, evidence, claim, or safety decisions.');
console.log(`Audit output: ${OUTPUT_PATH}`);
