import fs from 'node:fs/promises';

// TrendForge research is category-aware by design. Discovery should not become
// "AI first, everything else as a fallback". Each supported category gets its
// own discovery lanes, while the scoring/decision gates remain authoritative.
const feeds = [
  // Core categories
  ['AI', 'Google News', 'https://news.google.com/rss/search?q=AI%20technology%20OR%20artificial%20intelligence&hl=en-US&gl=US&ceid=US:en'],
  ['Technology', 'Google News', 'https://news.google.com/rss/search?q=technology%20OR%20software%20OR%20chips&hl=en-US&gl=US&ceid=US:en'],
  ['Digital Life', 'Google News', 'https://news.google.com/rss/search?q=privacy%20OR%20security%20OR%20apps%20OR%20smartphones&hl=en-US&gl=US&ceid=US:en'],
  ['How-To', 'Google News', 'https://news.google.com/rss/search?q=how%20to%20software%20OR%20apps%20guide&hl=en-US&gl=US&ceid=US:en'],

  // V2 expansion lanes: these must be discovered at research time, not only
  // after the main queue is exhausted.
  ['Innovation', 'Google News', 'https://news.google.com/rss/search?q=innovation%20OR%20breakthrough%20technology%20OR%20new%20invention&hl=en-US&gl=US&ceid=US:en'],
  ['Product Launches', 'Google News', 'https://news.google.com/rss/search?q=new%20product%20launch%20OR%20product%20announcement%20OR%20device%20launch&hl=en-US&gl=US&ceid=US:en'],
  ['Crypto', 'Google News', 'https://news.google.com/rss/search?q=crypto%20OR%20bitcoin%20OR%20ethereum%20OR%20blockchain&hl=en-US&gl=US&ceid=US:en'],

  // Publisher lanes add source diversity and reduce dependence on one feed.
  ['AI', 'TechCrunch', 'https://techcrunch.com/feed/'],
  ['Technology', 'Ars Technica', 'https://feeds.arstechnica.com/arstechnica/index'],
  ['Technology', 'MIT Technology Review', 'https://www.technologyreview.com/feed/'],
  ['Digital Life', 'The Verge', 'https://www.theverge.com/rss/index.xml'],
];

const SUPPORTED_CATEGORIES = ['AI', 'Technology', 'How-To', 'Innovation', 'Product Launches', 'Digital Life', 'Crypto'];
const PER_FEED_LIMIT = 20;
const CATEGORY_MIN_RESEARCH_TARGET = 8;
const CATEGORY_MAX_RESEARCH_TARGET = 24;

const decode = (s = '') => s
  .replace(/<!\[CDATA\[|\]\]>/g, '')
  .replace(/<[^>]*>/g, '')
  .replace(/&amp;/g, '&')
  .replace(/&#39;/g, "'")
  .replace(/&quot;/g, '"')
  .replace(/&#x27;/gi, "'")
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .trim();

const textTag = (xml, name) => {
  const match = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return match ? decode(match[1]) : '';
};

const attr = (xml, name, attribute) => {
  const match = xml.match(new RegExp(`<${name}[^>]*\\b${attribute}=["']([^"']+)["'][^>]*>`, 'i'));
  return match?.[1] ?? '';
};

const extractBlocks = (xml) => [
  ...(xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? []),
  ...(xml.match(/<entry\b[\s\S]*?<\/entry>/gi) ?? []),
];

const extractLink = (block) => {
  const href = attr(block, 'link', 'href');
  if (href) return href;
  return textTag(block, 'link');
};

const items = [];
for (const [category, sourceName, url] of feeds) {
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': 'TrendForgeBot/1.0 (+https://github.com/WebTooler/Trendforge)' },
      redirect: 'follow',
    });
    if (!res.ok) {
      console.log(`Feed ${sourceName} [${category}] returned ${res.status}`);
      continue;
    }

    const xml = await res.text();
    const blocks = extractBlocks(xml).slice(0, PER_FEED_LIMIT);

    for (const block of blocks) {
      const title = textTag(block, 'title');
      const link = extractLink(block);
      const description = textTag(block, 'description') || textTag(block, 'summary') || textTag(block, 'content');
      const published = textTag(block, 'pubDate') || textTag(block, 'published') || textTag(block, 'updated');
      if (!title || !link) continue;

      const publishedDate = new Date(published || Date.now());
      const publishedAt = Number.isNaN(publishedDate.getTime()) ? new Date().toISOString() : publishedDate.toISOString();

      items.push({
        title,
        link,
        source: sourceName,
        sourceUrl: url,
        publishedAt,
        category,
        description,
      });
    }
  } catch (error) {
    console.log(`Feed failed: ${sourceName} [${category}]: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const seen = new Set();
const candidates = items.filter((item) => {
  const key = item.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (!key || seen.has(key)) return false;
  seen.add(key);
  return true;
});

// Preserve category representation before global scoring. This is a discovery
// safeguard, not a publishing quota: weak categories are still allowed to have
// zero publishable articles after the downstream evidence/quality gates.
const byCategory = new Map(SUPPORTED_CATEGORIES.map((category) => [category, []]));
for (const candidate of candidates) {
  if (!byCategory.has(candidate.category)) byCategory.set(candidate.category, []);
  byCategory.get(candidate.category).push(candidate);
}

const categoryStats = SUPPORTED_CATEGORIES.map((category) => ({
  category,
  discovered: byCategory.get(category)?.length ?? 0,
  researchTarget: Math.min(
    CATEGORY_MAX_RESEARCH_TARGET,
    Math.max(CATEGORY_MIN_RESEARCH_TARGET, byCategory.get(category)?.length ?? 0),
  ),
}));

await fs.mkdir('data', { recursive: true });
await fs.writeFile(
  'data/trend-candidates.json',
  JSON.stringify({
    generatedAt: new Date().toISOString(),
    discoveryPolicy: {
      version: 2,
      supportedCategories: SUPPORTED_CATEGORIES,
      categoryAwareDiscovery: true,
      categoryMinResearchTarget: CATEGORY_MIN_RESEARCH_TARGET,
      categoryMaxResearchTarget: CATEGORY_MAX_RESEARCH_TARGET,
      publishQuota: false,
      note: 'Discovery seeks representation across categories; downstream evidence, editorial, duplicate, safety and SEO gates decide publication.',
    },
    categoryStats,
    candidates,
  }, null, 2),
);

console.log(`Collected ${candidates.length} unique trend candidates from ${feeds.length} feeds.`);
for (const stat of categoryStats) {
  console.log(`Discovery ${stat.category}: ${stat.discovered} candidate(s), target ${stat.researchTarget}.`);
}
