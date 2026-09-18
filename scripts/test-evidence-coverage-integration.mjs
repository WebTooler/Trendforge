import assert from 'node:assert/strict';
import { extractEvidenceFromHtml } from './evidence-extraction.mjs';
import { scoreEvidenceCoverage } from './evidence-coverage.mjs';

const SOURCES = [
  {
    publisherFamily: 'techcrunch',
    url: 'https://techcrunch.com/2026/09/17/the-fix-for-rogue-ai-agents-could-be-more-ai/',
    title: 'The fix for rogue AI agents could be more AI',
    primary: false
  },
  {
    publisherFamily: 'theverge',
    url: 'https://www.theverge.com/ai-artificial-intelligence/997134/anthropic-claude-code-projects',
    title: 'Claude Code relaunches Projects to manage multiple AI agents in the cloud',
    primary: false
  },
  {
    publisherFamily: 'ars',
    url: 'https://arstechnica.com/ai/2026/09/apple-reportedly-building-server-packed-with-m-series-ultra-chips-for-ai/',
    title: 'Apple reportedly building server packed with M-series Ultra chips for AI',
    primary: false
  },
  {
    publisherFamily: 'mit',
    url: 'https://news.mit.edu/2026/new-method-enables-ai-safety-critical-situations-0914',
    title: 'New method enables AI for safety-critical situations',
    primary: true
  }
];

async function fetchHtml(url) {
  const r = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(20000),
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; TrendForge-P1-integration-test/1.0)',
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'accept-language': 'en-US,en;q=0.9'
    }
  });
  const html = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return { html, finalUrl: r.url };
}

const extracted = [];
for (const source of SOURCES) {
  const { html, finalUrl } = await fetchHtml(source.url);
  const result = extractEvidenceFromHtml(html, source.title);
  assert.ok(result.passages.length >= 3, `${source.publisherFamily}: too few passages`);
  assert.ok(result.selectedChars >= 300, `${source.publisherFamily}: too little evidence`);
  extracted.push({
    ...source,
    url: finalUrl,
    verified: true,
    passages: result.passages,
    body: result.body
  });
  console.log(`${source.publisherFamily}: passages=${result.passages.length} chars=${result.selectedChars}`);
}

const coverage = scoreEvidenceCoverage({ sources: extracted });
console.log('coverage=', JSON.stringify(coverage));

assert.ok(coverage.sourceCount >= 3);
assert.ok(coverage.independentPublisherFamilies >= 3);
assert.ok(coverage.totalChars >= 1000);
assert.ok(coverage.totalPassages >= 6);
assert.ok(coverage.factualSignals >= 6);
assert.ok(coverage.verifiedSourceCount === coverage.sourceCount);
assert.equal(coverage.blockers.includes('single_publisher_family'), false);
assert.equal(coverage.blockers.includes('low_evidence_volume'), false);
assert.equal(coverage.blockers.includes('low_factual_density'), false);
assert.equal(coverage.readyForRichArticle, true);

console.log(`P1 integration: extractor -> coverage PASS (band=${coverage.band}, score=${coverage.score})`);
