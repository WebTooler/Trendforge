import fs from 'node:fs';

const path = 'data/trendforge-learning.json';
if (!fs.existsSync(path)) throw new Error(`Missing ${path}`);
const x = JSON.parse(fs.readFileSync(path, 'utf8'));

const checks = [
  ['mode is shadow', x.mode === 'shadow'],
  ['advisory only', x.policy?.advisoryOnly === true],
  ['cannot influence decisions', x.policy?.influencesDecisions === false],
  ['cannot change publication gates', x.policy?.changesPublicationGates === false],
  ['cannot change evidence thresholds', x.policy?.changesEvidenceThresholds === false],
  ['cannot change claim thresholds', x.policy?.changesClaimThresholds === false],
  ['sample metadata exists', Number.isInteger(x.sample?.runs) && Number.isInteger(x.sample?.topics)],
  ['trend section exists', x.trends && typeof x.trends === 'object'],
  ['signals are an array', Array.isArray(x.signals)],
  ['signals have provenance fields', x.signals.every(s => s.id && s.type && typeof s.observation === 'boolean' && s.sampleRuns === x.sample.runs && s.evidence && typeof s.evidence === 'object')],
  ['providers are an object', x.providers && typeof x.providers === 'object' && !Array.isArray(x.providers)],
];

for (const [name, pass] of checks) {
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}`);
  if (!pass) process.exitCode = 1;
}
if (process.exitCode) throw new Error('Self-learning deterministic checks failed');
console.log(`Self-learning deterministic suite: ${checks.length}/${checks.length} PASS`);
