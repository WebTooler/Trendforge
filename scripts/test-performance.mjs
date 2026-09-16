import fs from 'node:fs';

const x = JSON.parse(fs.readFileSync('data/trendforge-performance.json','utf8'));
const checks = [
  ['mode is shadow', x.mode === 'shadow'],
  ['observational only', x.policy?.observationalOnly === true],
  ['cannot influence decisions', x.policy?.influencesDecisions === false],
  ['cannot change publication gates', x.policy?.changesPublicationGates === false],
  ['cannot change evidence thresholds', x.policy?.changesEvidenceThresholds === false],
  ['cannot change claim thresholds', x.policy?.changesClaimThresholds === false],
  ['cannot change safety gates', x.policy?.changesSafetyGates === false],
  ['metrics exist', x.metrics && typeof x.metrics === 'object'],
  ['changes exist', x.changes && typeof x.changes === 'object'],
  ['providers exist', x.providers && typeof x.providers === 'object'],
  ['categories exist', x.categories && typeof x.categories === 'object'],
  ['bottlenecks are an array', Array.isArray(x.bottlenecks)],
  ['insights are an array', Array.isArray(x.insights)],
  ['minimum performance sample policy exists', x.policy?.minimumPerformanceRuns === 5],
];
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}`); if (!ok) process.exitCode = 1; }
console.log(`Performance deterministic suite: ${checks.filter(([,ok])=>ok).length}/${checks.length} PASS`);
if (process.exitCode) throw new Error('Performance deterministic suite failed');
