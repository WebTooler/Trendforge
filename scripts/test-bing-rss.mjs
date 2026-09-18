import assert from 'node:assert/strict';

const feeds = [
  ['AI', 'https://www.bing.com/news/search?q=AI%20technology%20OR%20artificial%20intelligence&format=rss'],
  ['Technology', 'https://www.bing.com/news/search?q=technology%20OR%20software%20OR%20chips&format=rss'],
  ['Digital Life', 'https://www.bing.com/news/search?q=privacy%20OR%20security%20OR%20smartphones&format=rss'],
  ['Innovation', 'https://www.bing.com/news/search?q=innovation%20OR%20breakthrough%20technology&format=rss'],
  ['Product Launches', 'https://www.bing.com/news/search?q=new%20product%20launch%20OR%20device%20launch&format=rss'],
  ['Crypto', 'https://www.bing.com/news/search?q=crypto%20OR%20bitcoin%20OR%20ethereum&format=rss'],
];

const results = [];
for (const [category, url] of feeds) {
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
      headers: {
        'user-agent': 'TrendForgeBot/2.0 (+https://github.com/WebTooler/Trendforge)',
        accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8'
      }
    });
    const text = await response.text();
    const itemCount = (text.match(/<item\b/gi) || []).length;
    const entryCount = (text.match(/<entry\b/gi) || []).length;
    results.push({ category, status: response.status, finalUrl: response.url, contentType: response.headers.get('content-type'), bytes: text.length, itemCount, entryCount, startsWithXml: /^\s*<\?xml/i.test(text), hasRss: /<rss\b/i.test(text), hasChannel: /<channel\b/i.test(text), preview: text.slice(0,180).replace(/\s+/g,' ') });
  } catch (error) {
    results.push({ category, error: error instanceof Error ? error.message : String(error) });
  }
}
console.log(JSON.stringify(results, null, 2));
const rssFeeds = results.filter(x => x.hasRss || x.hasChannel || x.itemCount > 0 || x.entryCount > 0);
assert.ok(rssFeeds.length > 0, 'Bing RSS diagnostic: no feed returned any RSS/Atom items');
console.log(`Bing RSS diagnostic: PASS — ${rssFeeds.length}/${results.length} feed(s) returned RSS/Atom-like content.`);
