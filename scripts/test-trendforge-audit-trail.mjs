import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const script = 'scripts/trendforge-audit-trail.mjs';
const output = 'data/trendforge-audit-trail.json';

execFileSync(process.execPath, [script], { stdio: 'inherit' });
const audit = JSON.parse(fs.readFileSync(output, 'utf8'));
const checks = [
  [audit.version === 1, 'version'],
  [audit.mode === 'append-only-observational', 'append-only mode'],
  [audit.eventCount === audit.events.length && audit.eventCount > 0, 'events retained'],
  [audit.events.every(e => e.id && e.type && e.phase && e.status && e.recordedAt), 'event schema'],
  [audit.events.every(e => e.workflowRun == null || String(e.workflowRun).length <= 80), 'workflowRun bounded'],
  [audit.policy.recordsEvents === true, 'records events'],
  [audit.policy.storesSecrets === false, 'no secrets'],
  [audit.policy.influencesDecisions === false, 'decision isolation'],
  [audit.policy.changesPublicationGates === false, 'publication isolation'],
  [audit.policy.changesEvidenceThresholds === false, 'evidence isolation'],
  [audit.policy.changesClaimThresholds === false, 'claim isolation'],
  [audit.policy.changesSafetyGates === false, 'safety isolation'],
  [audit.policy.autoRewriteArticle === false && audit.policy.autoDeleteArticle === false, 'article mutation isolation'],
  [audit.policy.autoPublish === false, 'publish isolation'],
  [audit.policy.maxEvents === 1000 && audit.events.length <= 1000, 'bounded history'],
  [audit.sources && audit.sources.memoryRuns >= 0, 'source metadata'],
];
const passed = checks.filter(([ok]) => ok).length;
for (const [ok, name] of checks) if (!ok) throw new Error(`Audit trail check failed: ${name}`);
console.log(`Phase 24 Complete Audit Trail deterministic suite: PASS (${passed}/${checks.length} checks)`);
console.log('Audit trail is append-only-observational and isolated from the publishing decision loop.');
