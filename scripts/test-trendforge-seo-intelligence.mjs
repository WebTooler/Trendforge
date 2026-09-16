import { auditSeoArticle, auditSeoArticles, seoIntelligencePolicy } from './trendforge-seo-intelligence.mjs';

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const good = { slug: 'ai-models-get-faster', title: 'AI Models Get Faster: What Changed and Why It Matters', description: 'A practical explanation of what changed in newer AI models and what readers should know.', category: 'AI' };
const shortTitle = { ...good, title: 'AI News' };
const longDescription = { ...good, description: 'x'.repeat(171) };
const missing = { slug: '', title: '', description: '' };

assert(auditSeoArticle(good).pass, 'Valid SEO article failed');
assert(auditSeoArticle(shortTitle).issues.includes('title_length'), 'Title length check failed');
assert(auditSeoArticle(longDescription).issues.includes('description_length'), 'Description length check failed');
assert(auditSeoArticle(missing).issues.includes('missing_title'), 'Missing title check failed');
assert(auditSeoArticle(missing).issues.includes('missing_description'), 'Missing description check failed');
assert(auditSeoArticle(missing).issues.includes('missing_slug'), 'Missing slug check failed');
const batch = auditSeoArticles([good, shortTitle]);
assert(batch.total === 2 && batch.passed === 1 && batch.failed === 1, 'Batch audit failed');
for (const key of ['changesPublicationGates','changesThresholds','changesResearch','changesEvidence','changesWriter','changesEditorial','changesClaimVerification','changesSafety']) assert(seoIntelligencePolicy[key] === false, `Isolation violation: ${key}`);
console.log('Phase 19 SEO Intelligence deterministic suite: 8/8 PASS');
console.log('SEO Intelligence is isolated from the TrendForge publishing pipeline.');
