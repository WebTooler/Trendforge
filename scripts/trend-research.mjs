import fs from 'node:fs/promises';

// TrendForge research is category-aware and multi-signal. Discovery signals are
// intentionally separated from evidence: a trend/search/social signal can
// nominate a story, but only real publisher/primary pages can later verify it.
const feeds = [
  // News discovery
  ['AI', 'Google News', 'https://news.google.com/rss/search?q=AI%20technology%20OR%20artificial%20intelligence&hl=en-US&gl=US&ceid=US:en', 'news'],
  ['Technology', 'Google News', 'https://news.google.com/rss/search?q=technology%20OR%20software%20OR%20chips&hl=en-US&gl=US&ceid=US:en', 'news'],
  ['Digital Life', 'Google News', 'https://news.google.com/rss/search?q=privacy%20OR%20security%20OR%20apps%20OR%20smartphones&hl=en-US&gl=US&ceid=US:en', 'news'],
  ['How-To', 'Google News', 'https://news.google.com/rss/search?q=how%20to%20software%20OR%20apps%20guide&hl=en-US&gl=US&ceid=US:en', 'news'],
  ['Innovation', 'Google News', 'https://news.google.com/rss/search?q=innovation%20OR%20breakthrough%20technology%20OR%20new%20invention&hl=en-US&gl=US&ceid=US:en', 'news'],
  ['Product Launches', 'Google News', 'https://news.google.com/rss/search?q=new%20product%20launch%20OR%20product%20announcement%20OR%20device%20launch&hl=en-US&gl=US&ceid=US:en', 'news'],
  ['Crypto', 'Google News', 'https://news.google.com/rss/search?q=crypto%20OR%20bitcoin%20OR%20ethereum%20OR%20blockchain&hl=en-US&gl=US&ceid=US:en', 'news'],

  // Independent news discovery network. Bing RSS is queried with simple terms + count=30 because
  // compound OR queries are intermittently returned as empty/HTML responses.
  // downstream source verification still requires real article pages.
  ['AI', 'Bing News', 'https://www.bing.com/news/search?q=AI&count=30&format=RSS', 'news'],
  // Bing's generic `technology` query intermittently returns non-RSS responses; use the
  // validated technology-specific fallback lane instead.
  ['Technology', 'Bing News', 'https://www.bing.com/news/search?q=gadgets&count=30&format=RSS', 'news'],
  ['Technology', 'Bing News', 'https://www.bing.com/news/search?q=consumer%20technology&count=30&format=RSS', 'news'],
  ['Digital Life', 'Bing News', 'https://www.bing.com/news/search?q=privacy&count=30&format=RSS', 'news'],
  ['Innovation', 'Bing News', 'https://www.bing.com/news/search?q=innovation&count=30&format=RSS', 'news'],
  ['Product Launches', 'Bing News', 'https://www.bing.com/news/search?q=product%20launch&count=30&format=RSS', 'news'],
  ['Crypto', 'Bing News', 'https://www.bing.com/news/search?q=crypto&count=30&format=RSS', 'news'],

  // Search-interest signal. Google Trends is not evidence and is marked
  // discoveryOnly so verification never treats it as a publisher source.
  ['AI', 'Google Trends', 'https://trends.google.com/trending/rss?geo=US', 'search-trend'],

  // Publisher lanes provide additional first-party discovery coverage.
  ['AI', 'TechCrunch', 'https://techcrunch.com/feed/', 'publisher'],
  ['Technology', 'Ars Technica', 'https://feeds.arstechnica.com/arstechnica/index', 'publisher'],
  ['Technology', 'MIT Technology Review', 'https://www.technologyreview.com/feed/', 'publisher'],
  ['Digital Life', 'The Verge', 'https://www.theverge.com/rss/index.xml', 'publisher'],
];

const SUPPORTED_CATEGORIES = ['AI', 'Technology', 'How-To', 'Innovation', 'Product Launches', 'Digital Life', 'Crypto'];
const PER_FEED_LIMIT = 20;
const CATEGORY_MIN_RESEARCH_TARGET = 8;
const CATEGORY_MAX_RESEARCH_TARGET = 24;

const decode = (s = '') => s
  .replace(/<!\[CDATA\[|\]\]>/g, '')
  .replace(/<[^>]*>/g, '')
  .replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
  .replace(/&#x27;/gi, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&nbsp;/gi, ' ').trim();
const textTag = (xml, name) => { const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i')); return m ? decode(m[1]) : ''; };
const attr = (xml, name, attribute) => { const m = xml.match(new RegExp(`<${name}[^>]*\\b${attribute}=["']([^"']+)["'][^>]*>`, 'i')); return m?.[1] ?? ''; };
const extractBlocks = (xml) => [...(xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? []), ...(xml.match(/<entry\b[\s\S]*?<\/entry>/gi) ?? [])];
const extractLink = (block) => attr(block, 'link', 'href') || textTag(block, 'link');

const items = [];
for (const [category, sourceName, url, signalType] of feeds) {
  try {
    const res = await fetch(url, { headers: { 'user-agent': 'TrendForgeBot/2.0 (+https://github.com/WebTooler/Trendforge)' }, redirect: 'follow' });
    if (!res.ok) { console.log(`Feed ${sourceName} [${category}] returned ${res.status}`); continue; }
    const xml = await res.text();
    for (const block of extractBlocks(xml).slice(0, PER_FEED_LIMIT)) {
      const title = textTag(block, 'title');
      const link = extractLink(block);
      const description = textTag(block, 'description') || textTag(block, 'summary') || textTag(block, 'content');
      const published = textTag(block, 'pubDate') || textTag(block, 'published') || textTag(block, 'updated');
      if (!title || !link) continue;
      const publishedDate = new Date(published || Date.now());
      const publishedAt = Number.isNaN(publishedDate.getTime()) ? new Date().toISOString() : publishedDate.toISOString();
      items.push({ title, link, source: sourceName, sourceUrl: url, publishedAt, category, description, signalType, discoveryOnly: signalType === 'search-trend' });
    }
  } catch (error) {
    console.log(`Feed failed: ${sourceName} [${category}]: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const seen = new Set();
const candidates = items.filter((item) => {
  const key = item.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const dedupeKey = `${item.category}:${key}`;
  if (!key || seen.has(dedupeKey)) return false;
  seen.add(dedupeKey);
  return true;
});

// Build a lightweight cross-signal map. This does not prove a story; it tells
// scoring whether attention is appearing in more than one discovery network.
const normalizeTopic = (value = '') => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(/\s+/).filter(Boolean).filter(w => w.length > 3);
const overlap = (a, b) => { const B = new Set(normalizeTopic(b)); return normalizeTopic(a).filter(w => B.has(w)).length; };
const enriched = candidates.map((candidate) => {
  const related = candidates.filter((other) => other !== candidate && other.category === candidate.category && overlap(candidate.title, other.title) >= 2);
  const networks = new Set([candidate.source, ...related.map(item => item.source)]);
  const signalTypes = new Set([candidate.signalType, ...related.map(item => item.signalType)]);
  return { ...candidate, researchSignals: { networkCount: networks.size, signalTypeCount: signalTypes.size, networks: [...networks], signalTypes: [...signalTypes], corroboratingCandidates: related.length } };
});

const byCategory = new Map(SUPPORTED_CATEGORIES.map((category) => [category, []]));
for (const candidate of enriched) { if (!byCategory.has(candidate.category)) byCategory.set(candidate.category, []); byCategory.get(candidate.category).push(candidate); }
const categoryStats = SUPPORTED_CATEGORIES.map((category) => ({ category, discovered: byCategory.get(category)?.length ?? 0, researchTarget: Math.min(CATEGORY_MAX_RESEARCH_TARGET, Math.max(CATEGORY_MIN_RESEARCH_TARGET, byCategory.get(category)?.length ?? 0)) }));

await fs.mkdir('data', { recursive: true });
await fs.writeFile('data/trend-candidates.json', JSON.stringify({
  generatedAt: new Date().toISOString(),
  discoveryPolicy: {
    version: 3,
    supportedCategories: SUPPORTED_CATEGORIES,
    categoryAwareDiscovery: true,
    multiSignalDiscovery: true,
    signals: ['Google News', 'Bing News', 'Google Trends', 'publisher RSS'],
    searchInterestIsEvidence: false,
    discoveryOnlySignalsCannotVerify: true,
    categoryMinResearchTarget: CATEGORY_MIN_RESEARCH_TARGET,
    categoryMaxResearchTarget: CATEGORY_MAX_RESEARCH_TARGET,
    publishQuota: false,
    note: 'Discovery seeks diverse signals; downstream evidence, editorial, duplicate, safety and SEO gates decide publication.'
  },
  categoryStats,
  candidates: enriched,
}, null, 2));

console.log(`Collected ${enriched.length} unique trend candidates from ${feeds.length} discovery feeds.`);
for (const stat of categoryStats) console.log(`Discovery ${stat.category}: ${stat.discovered} candidate(s), target ${stat.researchTarget}.`);
console.log('Research policy: Google Trends is a search-interest signal only; Google/Bing/publisher discovery does not count as evidence until a real source page is verified.');
