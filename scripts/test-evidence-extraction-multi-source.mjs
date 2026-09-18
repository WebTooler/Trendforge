import assert from 'node:assert/strict';
import { extractEvidenceFromHtml } from './evidence-extraction.mjs';

const SOURCES = [
  {
    name: 'TechCrunch — Rogue AI agents',
    url: 'https://techcrunch.com/2026/09/17/the-fix-for-rogue-ai-agents-could-be-more-ai/',
    title: 'The fix for rogue AI agents could be more AI',
    required: ['ai', 'agents', 'oversight']
  },
  {
    name: 'The Verge — Claude Code Projects',
    url: 'https://www.theverge.com/ai-artificial-intelligence/997134/anthropic-claude-code-projects',
    title: 'Claude Code relaunches Projects to manage multiple AI agents in the cloud',
    required: ['claude', 'projects', 'agents']
  },
  {
    name: 'Ars Technica — Apple AI server',
    url: 'https://arstechnica.com/ai/2026/09/apple-reportedly-building-server-packed-with-m-series-ultra-chips-for-ai/',
    title: 'Apple reportedly building server packed with M-series Ultra chips for AI',
    required: ['apple', 'server', 'ai']
  },
  {
    name: 'MIT News — HardFlow AI safety',
    url: 'https://news.mit.edu/2026/new-method-enables-ai-safety-critical-situations-0914',
    title: 'New method enables AI for safety-critical situations',
    required: ['ai', 'safety', 'constraints']
  }
];

const PROMO = /25%\s*off|save\s+up\s+to|buy\s+tickets|tickets?\s+now|subscribe\s+to\s+(?:our\s+)?newsletter|follow\s+us\s+for\s+more|advertisement|sponsored|partner\s+content|register\s+now|reserve\s+your\s+seat/i;

async function fetchHtml(url) {
  const r = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(20000),
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; TrendForge-P0-multi-source-test/1.0)',
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'accept-language': 'en-US,en;q=0.9'
    }
  });
  const html = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return { html, finalUrl: r.url };
}

console.log('P0 multi-source deterministic validation');
console.log(`sources=${SOURCES.length}`);

for (const source of SOURCES) {
  try {
    const { html, finalUrl } = await fetchHtml(source.url);
    const result = extractEvidenceFromHtml(html, source.title);
    const text = result.passages.join(' ');
    const lower = text.toLowerCase();
    const matchedRequired = source.required.filter(term => lower.includes(term.toLowerCase()));
    const promoHits = result.passages.filter(p => PROMO.test(p)).length;

    console.log(`\\n[${source.name}]`);
    console.log(`url=${finalUrl}`);
    console.log(`kind=${result.kind} rawParagraphs=${result.rawParagraphCount} passages=${result.passages.length} chars=${result.selectedChars} promoHits=${promoHits} requiredMatches=${matchedRequired.join(',')}`);

    assert.ok(result.passages.length >= 3, 'too few evidence passages');
    assert.ok(result.selectedChars >= 500, 'too little substantive evidence');
    assert.equal(promoHits, 0, 'promotional content leaked into evidence');
    assert.ok(matchedRequired.length >= Math.min(2, source.required.length), 'not enough story-specific terms retained');

    for (const p of result.passages.slice(0, 3)) console.log('-', p.slice(0, 220));
    console.log('PASS');
  } catch (error) {
    console.error(`FAIL: ${error.message}`);
    process.exitCode = 1;
  }
}

if (process.exitCode) {
  throw new Error('P0 multi-source validation failed');
}

console.log('\\nP0 multi-source test: PASS');
