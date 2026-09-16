import fs from 'node:fs';
import { getCommentsPolicy } from './trendforge-comments.mjs';

const component = fs.readFileSync('app/components/CommentsWidget.tsx', 'utf8');
const articlePage = fs.readFileSync('app/article/[slug]/page.tsx', 'utf8');
const policy = getCommentsPolicy();

const protectedFlags = [
  'influencesResearch',
  'influencesEvidence',
  'influencesDecisions',
  'influencesWriter',
  'influencesEditorial',
  'influencesClaimVerification',
  'influencesQuality',
  'influencesSafety',
  'influencesLifecycle',
  'influencesSearch',
  'influencesSeo',
  'influencesDistribution',
  'influencesMonetization',
  'changesPublicationGates',
  'changesThresholds',
  'autoRewrite',
  'autoDelete',
];

for (const flag of protectedFlags) {
  if (policy[flag] !== false) throw new Error(`Comments policy violation: ${flag} must remain false`);
}

if (policy.provider !== 'utterances') throw new Error('Unexpected comments provider');
if (policy.repository !== 'WebTooler/Trendforge') throw new Error('Comments repository mismatch');
if (policy.mapping !== 'pathname') throw new Error('Comments must map to article pathname');
if (policy.label !== 'comments') throw new Error('Comments label mismatch');
if (!component.includes("https://utteranc.es/client.js")) throw new Error('Utterances client missing');
if (!component.includes("setAttribute('repo', 'WebTooler/Trendforge')")) throw new Error('Utterances repository missing');
if (!component.includes("setAttribute('issue-term', 'pathname')")) throw new Error('Pathname mapping missing');
if (!component.includes("setAttribute('label', 'comments')")) throw new Error('Comments label missing');
if (component.includes("fetch(") || component.includes("/api/")) throw new Error('Comments widget must not call TrendForge APIs');
if (!articlePage.includes("import CommentsWidget from '@/app/components/CommentsWidget';")) throw new Error('Comments widget is not imported by article page');
if (!articlePage.includes('<CommentsWidget articleSlug={article.slug}/>')) throw new Error('Comments widget is not rendered on article page');

console.log('Phase 16 Comments deterministic suite: PASS');
console.log('Comments are isolated from the TrendForge publishing pipeline.');
console.log(JSON.stringify({ provider: policy.provider, repository: policy.repository, mapping: policy.mapping, label: policy.label }));
