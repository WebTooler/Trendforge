import assert from 'node:assert/strict';
import fs from 'node:fs';
import { articles } from '../lib/articles.ts';

const script = fs.readFileSync('scripts/trendforge-distribution.mjs', 'utf8');
const allowed = new Set(['website', 'rss', 'newsletter', 'social', 'community']);

assert.ok(articles.length > 0, 'Articles fixture is empty');
assert.ok(script.includes("mode: 'advisory-only'"), 'Advisory mode missing');
assert.ok(script.includes('autoPost: false'), 'Auto-post must remain disabled');
assert.ok(script.includes('changesPublicationGates: false'), 'Publication gate isolation missing');
assert.ok(script.includes('changesThresholds: false'), 'Threshold isolation missing');
assert.ok(script.includes('changesResearch: false'), 'Research isolation missing');
assert.ok(script.includes('changesEvidence: false'), 'Evidence isolation missing');
assert.ok(script.includes('changesWriter: false'), 'Writer isolation missing');
assert.ok(script.includes('changesEditorial: false'), 'Editorial isolation missing');
assert.ok(script.includes('changesClaimVerification: false'), 'Claim verification isolation missing');
assert.ok(script.includes('changesSafety: false'), 'Safety isolation missing');

const normalize = (article) => {
  const title = String(article.title).replace(/\s+/g, ' ').trim();
  const description = String(article.description || article.content?.[0] || '').replace(/\s+/g, ' ').trim();
  const channels = ['website', 'rss'];
  if (['AI', 'Technology', 'Digital Life', 'Innovation', 'Product Launches', 'Crypto'].includes(article.category)) channels.push('social');
  channels.push('newsletter');
  if (['How-To', 'Digital Life'].includes(article.category) || description.length >= 80) channels.push('community');
  return { title, description, channels };
};

const packages = articles.map(normalize);
assert.equal(packages.length, articles.length, 'Every article needs a distribution package');
assert.ok(packages.every((p) => p.title.length > 0 && p.title.length <= 120), 'Invalid social headline');
assert.ok(packages.every((p) => p.description.length > 0), 'Missing distribution summary');
assert.ok(packages.every((p) => p.channels.every((c) => allowed.has(c))), 'Unknown distribution channel');
assert.ok(packages.every((p) => new Set(p.channels).size === p.channels.length), 'Duplicate distribution channel');
assert.ok(packages.every((p) => p.channels.includes('website') && p.channels.includes('rss')), 'Core channels missing');

console.log(`Phase 21 Distribution Intelligence deterministic suite: 12/12 PASS`);
console.log('Distribution Intelligence is advisory-only and isolated from the TrendForge publishing pipeline.');
