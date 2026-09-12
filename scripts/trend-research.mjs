import fs from 'node:fs/promises';

const feeds = [
  ['Google News AI', 'https://news.google.com/rss/search?q=AI%20technology&hl=en-US&gl=US&ceid=US:en'],
  ['Google News Technology', 'https://news.google.com/rss/search?q=technology%20digital&hl=en-US&gl=US&ceid=US:en'],
  ['Google News How-To', 'https://news.google.com/rss/search?q=how%20to%20apps%20software&hl=en-US&gl=US&ceid=US:en'],
];

const clean = (s) => s.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").trim();
const tag = (xml, name) => [...xml.matchAll(new RegExp(`<${name}(?:[^>]*)>([\\s\\S]*?)<\\/${name}>`, 'gi'))].map(m => clean(m[1]));

const items = [];
for (const [source, url] of feeds) {
  try {
    const res = await fetch(url, { headers: { 'user-agent': 'TrendForgeBot/1.0' } });
    if (!res.ok) continue;
    const xml = await res.text();
    const blocks = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
    for (const block of blocks.slice(0, 12)) {
      const title = tag(block, 'title')[0];
      const link = tag(block, 'link')[0];
      const pubDate = tag(block, 'pubDate')[0];
      if (title && link) items.push({ title, link, source, pubDate: pubDate || null });
    }
  } catch {}
}

const seen = new Set();
const candidates = items.filter(x => {
  const key = x.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (seen.has(key)) return false;
  seen.add(key); return true;
}).map((x, i) => ({ ...x, score: Math.max(1, 100 - i * 3) }))
  .sort((a, b) => b.score - a.score);

await fs.mkdir('data', { recursive: true });
await fs.writeFile('data/trend-candidates.json', JSON.stringify({ generatedAt: new Date().toISOString(), candidates }, null, 2));
console.log(`Collected ${candidates.length} unique trend candidates.`);
