import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const scripts = [
  'scripts/trend-decision-engine.mjs',
  'scripts/verify-trend-sources.mjs',
  'scripts/verify-article-claims-v2.mjs',
  'scripts/verify-article-claims-smart.mjs',
  'scripts/editorial-intelligence.mjs',
  'scripts/ai-provider-router.mjs',
  'scripts/trendforge-editorial-policy.mjs',
  'scripts/trendforge-writer-engine.mjs',
  'scripts/validate-writer-output.mjs',
  'scripts/generate-article-adaptive.mjs',
  'scripts/repair-article-grounding.mjs',
  'scripts/growth-intelligence.mjs',
  'scripts/distribution-intelligence.mjs',
  'scripts/monetization-check.mjs',
];
const requiredOutputs = [
  'data/decision-queue.json',
  'data/source-verification.json',
  'data/claim-verification.json',
  'data/editorial-scores.json',
  'data/article-lifecycle.json',
  'data/growth-intelligence.json',
  'data/distribution-intelligence.json',
  'data/monetization-readiness.json',
];

let failed = false;
for (const file of scripts) {
  if (!fs.existsSync(file)) { console.error(`SELF-CHECK FAIL: missing ${file}`); failed=true; continue; }
  const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  if(result.status!==0){console.error(`SELF-CHECK FAIL: ${file}\n${result.stderr||result.stdout}`);failed=true;} else console.log(`SELF-CHECK PASS: ${file}`);
}
for(const file of requiredOutputs){
  if(!fs.existsSync(file)){console.error(`SELF-CHECK FAIL: missing output ${file}`);failed=true;continue;}
  try{JSON.parse(fs.readFileSync(file,'utf8'));console.log(`SELF-CHECK PASS: valid JSON ${file}`);}catch(error){console.error(`SELF-CHECK FAIL: invalid JSON ${file} — ${error.message}`);failed=true;}
}

if(failed){console.error('V2 self-check BLOCKED the pipeline.');process.exit(1);}
console.log('V2 self-check: PASS');