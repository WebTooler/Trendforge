import { rankSearchArticle, rankSearchResults, tokenizeSearch, normalizeSearch, searchIntelligencePolicy } from './trendforge-search-intelligence.mjs';

const articles = [
  { slug: 'ai', title: 'AI Models Get Faster', description: 'A guide to new AI models.', category: 'AI', date: '2026-09-15', content: 'artificial intelligence models performance' },
  { slug: 'phone', title: 'A Practical Phone Guide', description: 'Technology tips.', category: 'Technology', date: '2026-08-01', content: 'phone settings and technology' },
  { slug: 'digital', title: 'Digital Life Basics', description: 'Everyday digital advice.', category: 'Digital Life', date: '2026-09-10', content: 'privacy and accounts' },
];

const assert = (condition, message) => { if (!condition) throw new Error(message); };
assert(normalizeSearch('  AI, Models!  ') === 'ai models', 'Normalization failed');
assert(tokenizeSearch('AI x models').join('|') === 'ai|models', 'Tokenization failed');
assert(rankSearchArticle(articles[0], 'AI Models') > rankSearchArticle(articles[1], 'AI Models'), 'Relevant article did not rank first');
assert(rankSearchResults(articles, 'phone')[0].slug === 'phone', 'Exact relevant result failed');
assert(rankSearchResults(articles, 'technology', 'Technology').length === 1, 'Category filtering failed');
assert(rankSearchResults(articles, 'zzzz').length === 0, 'No-match handling failed');
for (const key of ['changesPublicationGates','changesThresholds','changesResearch','changesEvidence','changesWriter','changesEditorial','changesClaimVerification','changesSafety']) assert(searchIntelligencePolicy[key] === false, `Isolation violation: ${key}`);
assert(searchIntelligencePolicy.maxQueryLength === 100, 'Query bound missing');
console.log('Phase 18 Search Intelligence deterministic suite: 7/7 PASS');
console.log('Search ranking is isolated from the TrendForge publishing pipeline.');
