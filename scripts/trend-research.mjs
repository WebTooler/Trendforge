import fs from 'node:fs/promises';

const feeds = [
  ['AI', 'https://news.google.com/rss/search?q=AI%20technology%20OR%20artificial%20intelligence&hl=en-US&gl=US&ceid=US:en'],
  ['Technology', 'https://news.google.com/rss/search?q=technology%20OR%20software%20OR%20chips&hl=en-US&gl=US&ceid=US:en'],
  ['Digital Life', 'https://news.google.com/rss/search?q=privacy%20OR%20security%20OR%20apps%20OR%20smartphones&hl=en-US&gl=US&ceid=US:en'],
  ['How-To', 'https://news.google.com/rss/search?q=how%20to%20software%20OR%20apps%20guide&hl=en-US&gl=US&ceid=US:en'],
];

const decode = (s = '') => s
  .replace(/<!\[CDATA\[|\]\]>/g, '')
  .replace(/<[^>]*>/g, '')
  .replace(/&amp;/g, '&')
  .replace(/&#39;/g, "'")
  .replace(/&quot;/g, '"')
  .trim();

const tag = (xml, name) => [...xml.matchAll(new RegExp(`<${name}(?:[^>]*)>([\\s\\S]*?)<\\/${name}>`, 'i'))].map(m => decode(m[1]));
const attrTag = (xml, name, attr) => {
  const match = xml.match(new RegExp(`<${name}[^>]*\\b${attr}=["']([^"']+)["'][^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return match ? { value: decode(match[2]), attribute: match[1] } : null;
};

const items = [];
for (const [category, url] of feeds) {
  try {
    const res = await fetch(url, { headers: { 'user-agent': 'TrendForgeBot/1.0' } });
    if (!res.ok) continue;
    const xml = await res.text();
    const blocks = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
    for (const block of blocks.slice(0, 15)) {
      const title = tag(block, 'title')[0];
      const link = tag(block, 'link')[0];
      const description = tag(block, 'description')[0] || '';
      const publishedAt = tag(block, 'pubDate')[0] || new Date().toISOString();
      const sourceTag = attrTag(block, 'source', 'url');
      if (!title || !link) continue;

      let resolvedUrl = link;
      try {
        const articleResponse = await fetch(link, { method: 'HEAD', redirect: 'follow', headers: { 'user-agent': 'TrendForgeBot/1.0' } });
        if (articleResponse.url?.startsWith('https://')) resolvedUrl = articleResponse.url;
      } catch {}

      items.push({
        title,
        link: resolvedUrl,
        source: sourceTag?.value || 'Unknown publisher',
        sourceUrl: sourceTag?.attribute || '',
        publishedAt: new Date(publishedAt).toISOString(),
        category,
        description,
      });
    }
  } catch {
    console.log(`Feed failed: ${category}`);
  }
}

const seen = new Set();
const candidates = items.filter(item => {
  const key = item.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

await fs.mkdir('data', { recursive: true });
await fs.writeFile('data/trend-candidates.json', JSON.stringify({ generatedAt: new Date().toISOString(), candidates }, null, 2));
console.log(`Collected ${candidates.length} unique trend candidates.`);
