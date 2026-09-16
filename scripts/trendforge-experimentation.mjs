import fs from 'node:fs';

const DATA = 'data';
const MEMORY_PATH = `${DATA}/trendforge-memory.json`;
const LEARNING_PATH = `${DATA}/trendforge-learning.json`;
const EXPERIMENT_PATH = `${DATA}/trendforge-experiments.json`;
const now = new Date().toISOString();

function readJson(path, fallback = null) {
  try { return JSON.parse(fs.readFileSync(path, 'utf8')); } catch { return fallback; }
}
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
function avg(values) { const xs = values.map(num).filter(v => v != null); return xs.length ? Math.round(xs.reduce((a,b)=>a+b,0)/xs.length) : null; }
function hash(value) { let h = 2166136261; for (const c of String(value)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

const memory = readJson(MEMORY_PATH);
const learning = readJson(LEARNING_PATH, {});
if (!memory || typeof memory !== 'object') throw new Error(`Invalid or missing ${MEMORY_PATH}`);
const runs = Array.isArray(memory.runs) ? memory.runs : [];
const topics = Array.isArray(memory.topics) ? memory.topics : [];
const articles = Array.isArray(memory.articles) ? memory.articles : [];

// Phase 12 is a controlled, shadow-only experimentation framework. It may design
// and simulate experiments, but it never changes publication gates or live content.
const registry = [
  { id: 'headline-style', variable: 'headline', control: 'standard', variant: 'benefit-led', eligible: 'editorial-only' },
  { id: 'intro-style', variable: 'introduction', control: 'context-first', variant: 'answer-first', eligible: 'editorial-only' },
  { id: 'cta-placement', variable: 'subscribe-cta', control: 'end-of-article', variant: 'after-first-section', eligible: 'engagement-only' },
];

const safeEligibility = (experiment) => experiment.eligible !== 'publication-gate' && experiment.eligible !== 'evidence-gate' && experiment.eligible !== 'claim-gate';
const experiments = registry.filter(safeEligibility).map(experiment => ({
  ...experiment,
  status: 'shadow',
  assignment: { controlPercent: 50, variantPercent: 50, deterministic: true },
  guardrails: {
    changesPublicationGates: false,
    changesEvidenceThresholds: false,
    changesClaimThresholds: false,
    changesSafetyGates: false,
    liveMutation: false,
  },
}));

const recentTopics = topics.slice(-Math.min(topics.length, 50));
const assignments = {};
for (const experiment of experiments) {
  assignments[experiment.id] = recentTopics.slice(-20).map(topic => {
    const key = `${experiment.id}:${topic.key ?? topic.title ?? ''}`;
    return { key: topic.key ?? topic.title ?? null, bucket: hash(key) % 2 === 0 ? 'control' : 'variant' };
  });
}

const outcomes = experiments.map(experiment => {
  const assigned = assignments[experiment.id] ?? [];
  const control = assigned.filter(x => x.bucket === 'control').length;
  const variant = assigned.length - control;
  return {
    experimentId: experiment.id,
    sample: { control, variant, total: assigned.length },
    outcomeMetrics: {
      editorialScore: avg(articles.map(a => a.editorialScore ?? a.score)),
      claimConfidence: avg(runs.map(r => r.claims?.averageConfidence)),
      evidencePassRate: avg(runs.map(r => {
        const e = r.evidence; return e?.candidates > 0 ? (e.passed / e.candidates) * 100 : null;
      })),
    },
    conclusion: 'insufficient-data',
    confidence: runs.length >= 10 && assigned.length >= 20 ? 'medium' : 'low',
  };
});

const output = {
  version: 1,
  updatedAt: now,
  mode: 'shadow',
  policy: {
    advisoryOnly: true,
    liveMutation: false,
    changesPublicationGates: false,
    changesEvidenceThresholds: false,
    changesClaimThresholds: false,
    changesSafetyGates: false,
    requiresMinimumRuns: 10,
    requiresMinimumAssignmentsPerArm: 20,
    noWinnerBeforeMinimumSample: true,
  },
  sample: { runs: runs.length, topics: topics.length, articles: articles.length },
  learningInput: {
    version: learning.version ?? null,
    mode: learning.mode ?? null,
    signalCount: Array.isArray(learning.signals) ? learning.signals.length : 0,
  },
  experiments,
  assignments,
  outcomes,
  history: {
    previousUpdatedAt: readJson(EXPERIMENT_PATH, {})?.updatedAt ?? null,
  },
};

fs.mkdirSync(DATA, { recursive: true });
fs.writeFileSync(EXPERIMENT_PATH, `${JSON.stringify(output, null, 2)}\n`);
console.log(`TrendForge Experimentation v1: ${experiments.length} experiment(s), ${assignments[experiments[0]?.id ?? '']?.length ?? 0} assignment sample(s).`);
console.log('Mode: SHADOW — experiments may measure and learn, but cannot mutate live content or publication gates.');
console.log(`Experiment output: ${EXPERIMENT_PATH}`);
