const probes = [
  ['AI-simple', 'https://www.bing.com/news/search?q=AI&format=RSS'],
  ['AI-plus', 'https://www.bing.com/news/search?q=AI+technology&format=RSS'],
  ['AI-or', 'https://www.bing.com/news/search?q=AI+OR+artificial+intelligence&format=RSS'],
  ['Technology-simple', 'https://www.bing.com/news/search?q=technology&format=RSS'],
  ['Technology-or', 'https://www.bing.com/news/search?q=technology+OR+software+OR+chips&format=RSS'],
  ['Innovation-simple', 'https://www.bing.com/news/search?q=innovation&format=RSS'],
  ['Innovation-or', 'https://www.bing.com/news/search?q=innovation+OR+breakthrough+technology&format=RSS'],
  ['Crypto-simple', 'https://www.bing.com/news/search?q=crypto&format=RSS'],
  ['Crypto-or', 'https://www.bing.com/news/search?q=crypto+OR+bitcoin+OR+ethereum&format=RSS'],
];

for (const [name, url] of probes) {
  try {
    const r = await fetch(url, { redirect:'follow', signal:AbortSignal.timeout(10000), headers:{'user-agent':'TrendForgeBot/2.0 (+https://github.com/WebTooler/Trendforge)',accept:'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8'} });
    const body = await r.text();
    const items=(body.match(/<item\b/gi)||[]).length;
    console.log(JSON.stringify({name,status:r.status,contentType:r.headers.get('content-type'),bytes:body.length,items,finalUrl:r.url}));
  } catch(e) { console.log(JSON.stringify({name,error:e?.message||String(e)})); }
}
