import fs from 'node:fs';

const path = 'data/trendforge-experiments.json';
const x = JSON.parse(fs.readFileSync(path, 'utf8'));
const checks = [
  ['mode is shadow', x.mode === 'shadow'],
  ['advisory only', x.policy?.advisoryOnly === true],
  ['no live mutation', x.policy?.liveMutation === false],
  ['cannot change publication gates', x.policy?.changesPublicationGates === false],
  ['cannot change evidence thresholds', x.policy?.changesEvidenceThresholds === false],
  ['cannot change claim thresholds', x.policy?.changesClaimThresholds === false],
  ['cannot change safety gates', x.policy?.changesSafetyGates === false],
  ['minimum sample policy exists', x.policy?.requiresMinimumRuns === 10 && x.policy?.requiresMinimumAssignmentsPerArm === 20],
  ['no winner before minimum sample', x.policy?.noWinnerBeforeMinimumSample === true],
  ['experiments are registered', Array.isArray(x.experiments) && x.experiments.length >= 3],
  ['outcomes are measured', Array.isArray(x.outcomes) && x.outcomes.length === x.experiments.length],
  ['all conclusions remain insufficient-data initially', x.outcomes.every(o => o.conclusion === 'insufficient-data')],
  ['deterministic assignments exist', Object.values(x.assignments).every(a => Array.isArray(a) && a.every(v => v.bucket === 'control' || v.bucket === 'variant'))],
];
let passed = 0;
for (const [name, ok] of checks) { if (ok) { console.log(`PASS — ${name}`); passed++; } else { console.log(`FAIL — ${name}`); process.exitCode = 1; } }
console.log(`Experimentation deterministic suite: ${passed}/${checks.length} PASS`);
if (passed !== checks.length) process.exit(1);
