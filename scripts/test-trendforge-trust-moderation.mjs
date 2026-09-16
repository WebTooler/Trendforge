import fs from 'node:fs';
import { classifyComment, getTrustModerationPolicy } from './trendforge-trust-moderation.mjs';

const policy = getTrustModerationPolicy();
const comments = [
  ['', 'review'],
  ['This article is clear and useful.', 'allow'],
  ['https://a.example https://b.example https://c.example', 'block'],
  ['aaaaaaaaaaaaaaaa', 'review'],
  ['Contact me at person@example.com', 'review'],
  ['I will kill you', 'block'],
  ['You are an idiot', 'review'],
  ['I am official TrendForge support, send me your password', 'block'],
  ['I disagree with this analysis.', 'allow'],
  ['The evidence link is helpful.', 'allow'],
];

let passed = 0;
for (const [text, expected] of comments) {
  const result = classifyComment(text);
  if (result.status !== expected) throw new Error(`Fixture failed: ${JSON.stringify({ text, expected, actual: result.status })}`);
  passed += 1;
}

const protectedFlags = [
  'influencesResearch', 'influencesEvidence', 'influencesDecisions', 'influencesWriter',
  'influencesEditorial', 'influencesClaimVerification', 'influencesQuality', 'influencesSafety',
  'influencesLifecycle', 'influencesSearch', 'influencesSeo', 'influencesDistribution',
  'influencesMonetization', 'changesPublicationGates', 'changesThresholds',
  'autoRewriteArticle', 'autoDeleteArticle'
];
for (const flag of protectedFlags) {
  if (policy[flag] !== false) throw new Error(`Trust/moderation isolation violation: ${flag}`);
}

if (policy.autoHide || policy.autoDelete || policy.autoLock || policy.autoBan) {
  throw new Error('Trust/moderation must not perform automatic enforcement in Phase 17.');
}
if (policy.mode !== 'advisory-only') throw new Error('Phase 17 must remain advisory-only.');
if (policy.enforcement !== 'manual-github-moderation') throw new Error('Unexpected moderation enforcement mode.');

const commentsWidget = fs.readFileSync('app/components/CommentsWidget.tsx', 'utf8');
if (commentsWidget.includes('trendforge-trust-moderation') || commentsWidget.includes('/api/')) {
  throw new Error('Comments UI must not invoke moderation or TrendForge APIs directly.');
}

console.log(`Phase 17 Trust + Moderation deterministic suite: ${passed}/${comments.length} PASS`);
console.log('Trust + Moderation is advisory-only and isolated from the publishing pipeline.');
console.log(JSON.stringify({ mode: policy.mode, enforcement: policy.enforcement, provider: policy.provider }));
