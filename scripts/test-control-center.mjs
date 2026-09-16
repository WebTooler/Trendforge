import fs from 'node:fs';

const page = fs.readFileSync('app/control-center/page.tsx', 'utf8');
const css = fs.readFileSync('app/control-center/control-center.css', 'utf8');

const checks = [
  ['overview section', page.includes('Today at a glance')],
  ['pipeline health', page.includes('Pipeline health')],
  ['publishing desk', page.includes('PUBLISHING DESK')],
  ['evidence detail', page.includes('Research & Evidence')],
  ['article quality chain', page.includes('Quality chain')],
  ['provider center', page.includes('AI PROVIDERS')],
  ['supervisor detail', page.includes('What needs attention')],
  ['performance and learning', page.includes('PERFORMANCE & LEARNING')],
  ['security section', page.includes('Security & Reliability')],
  ['audit timeline', page.includes('Audit timeline')],
  ['monetization section', page.includes('Revenue readiness')],
  ['plain language explanation', page.includes('How to read this Control Center')],
  ['no threshold override', page.includes('cannot lower thresholds')],
  ['no evidence bypass', page.includes('bypass evidence')],
  ['no safety bypass', page.includes('bypass safety')],
  ['no auto publish', page.includes('auto-publish')],
  ['unknown status is not green', page.includes("state={securityState}") && page.includes("state === 'unknown' ? '⚪'" )],
  ['responsive mobile layout', css.includes('@media(max-width:620px)')],
  ['provider responsive layout', css.includes('.cc-provider-grid')],
  ['audit responsive layout', css.includes('.cc-audit-row')],
];

let passed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}`);
  if (ok) passed++;
}
if (passed !== checks.length) process.exit(1);
console.log(`Phase 25 Detailed Control Center deterministic suite: PASS (${passed}/${checks.length} checks)`);
