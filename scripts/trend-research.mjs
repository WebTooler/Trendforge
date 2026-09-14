import fs from 'node:fs/promises';

// Google News RSS is useful but unofficial and can be unavailable from CI runners.
// Keep it as one source, but use publisher RSS/Atom feeds as the reliable fallback.
const feeds = [
  ['AI', 'Google News', 'https://news.google.com/rss/search?q=AI%20technology%20OR%20artificial%20intelligence&hl=en-US&gl=US&ceid=US:en'],
  ['Technology', 'Google News', 'https://news.google.com/rss/search?q=technology%20OR%20software%20OR%20chips&hl=en-US&gl=US&ceid=US:en'],
  ['Digital Life', 'Google News', 'https://news.google.com/rss/search?q=privacy%20OR%20security%20OR%20apps%20OR%20smartphones&hl=en-US&gl=US&ceid=US:en'],
  ['How-To', 'Google News', 'https://news.google.com/rss/search?q=how%20to%20software%20OR%20apps%20guide&hl=en-US&gl=US&ceid=US:en'],
  ['AI', 'TechCrunch', 'https://techcrunch.com/feed/'],
  ['Technology', 'Ars Technica', 'https://feeds.arstechnica.com/arstechnica/index'],
  ['Technology', 'MIT Technology Review', 'https://www.technologyreview.com/feed/'],
  ['Digital Life', 'The Verge', 'https://www.theverge.com/rss/index.xml'],
];

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
      console.log(`Feed ${sourceName} returned ${res.status}`);
      continue;
    }

    const xml = await res.text();
    const blocks = extractBlocks(xml).slice(0, 20);

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
    console.log(`Feed failed: ${sourceName}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const seen = new Set();
const candidates = items.filter((item) => {
  const key = item.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (!key || seen.has(key)) return false;
  seen.add(key);
  return true;
});

await fs.mkdir('data', { recursive: true });
await fs.writeFile('data/trend-candidates.json', JSON.stringify({ generatedAt: new Date().toISOString(), candidates }, null, 2));
console.log(`Collected ${candidates.length} unique trend candidates from ${feeds.length} feeds.`);

// Manual pipeline trigger marker v4; no runtime behavior change.
