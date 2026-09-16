import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const OUTPUT = 'data/trendforge-supervisor.json';
const POLICY_KEYS = ['observationalOnly','influencesDecisions','changesPublicationGates','changesEvidenceThresholds','changesClaimThresholds','changesSafetyGates','autoRewriteArticle','autoDeleteArticle','autoPublish'];

execFileSync(process.execPath, ['scripts/trendforge-supervisor.mjs'], { stdio: 'inherit' });
if (!fs.existsSync(OUTPUT)) throw new Error('Supervisor output missing');
const out = JSON.parse(fs.readFileSync(OUTPUT, 'utf8'));

const assertions = [
  ['version is 1', out.version === 1],
  ['mode is advisory-observational', out.mode === 'advisory-observational'],
  ['policy is observational', out.policy?.observationalOnly === true],
  ['does not influence decisions', out.policy?.influencesDecisions === false],
  ['does not change publication gates', out.policy?.changesPublicationGates === false],
  ['does not change evidence thresholds', out.policy?.changesEvidenceThresholds === false],
  ['does not change claim thresholds', out.policy?.changesClaimThresholds === false],
  ['does not change safety gates', out.policy?.changesSafetyGates === false],
  ['no auto rewrite', out.policy?.autoRewriteArticle === false],
  ['no auto delete', out.policy?.autoDeleteArticle === false],
  ['no auto publish', out.policy?.autoPublish === false],
  ['recommendations are bounded', Array.isArray(out.recommendations) && out.recommendations.length <= 3],
  ['bottlenecks are bounded', Array.isArray(out.bottlenecks) && out.bottlenecks.length <= 20],
  ['metrics are present', out.metrics && typeof out.metrics === 'object'],
  ['phase health is present', out.phaseHealth && typeof out.phaseHealth === 'object'],
  ['source metadata is present', out.source && typeof out.source === 'object'],
];

for (const [name, ok] of assertions) if (!ok) throw new Error(`Supervisor assertion failed: ${name}`);
for (const key of POLICY_KEYS) if (!(key in out.policy)) throw new Error(`Supervisor policy key missing: ${key}`);
console.log(`Phase 23 TrendForge Supervisor deterministic suite: PASS (${assertions.length} checks)`);
console.log('Supervisor is advisory-observational and isolated from the publishing decision loop.');
