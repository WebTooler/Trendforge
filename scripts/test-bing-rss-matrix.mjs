const probes = [
  ['AI-primary', 'https://www.bing.com/news/search?q=AI&count=30&format=RSS'],
  ['AI-fallback', 'https://www.bing.com/news/search?q=AI&first=1&count=30&format=RSS'],
  ['Technology-primary', 'https://www.bing.com/news/search?q=technology&count=30&format=RSS'],
  ['Technology-fallback', 'https://www.bing.com/news/search?q=technology&first=1&count=30&format=RSS'],
  ['Digital-Life-primary', 'https://www.bing.com/news/search?q=privacy&count=30&format=RSS'],
  ['Digital-Life-fallback', 'https://www.bing.com/news/search?q=privacy&first=1&count=30&format=RSS'],
  ['Innovation-primary', 'https://www.bing.com/news/search?q=innovation&count=30&format=RSS'],
  ['Product-Launches-primary', 'https://www.bing.com/news/search?q=product%20launch&count=30&format=RSS'],
  ['Crypto-primary', 'https://www.bing.com/news/search?q=crypto&count=30&format=RSS'],
];

const result = [];
for (const [name, url] of probes) {
  try {
    const r = await fetch(url, { redirect:'follow', signal:AbortSignal.timeout(10000), headers:{'user-agent':'TrendForgeBot/2.0 (+https://github.com/WebTooler/Trendforge)',accept:'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8'} });
    const body = await r.text();
    const items=(body.match(/<item\b/gi)||[]).length;
    const entries=(body.match(/<entry\b/gi)||[]).length;
    const channels=(body.match(/<channel\b/gi)||[]).length;
    const rss=(body.match(/<rss\b/gi)||[]).length;
    const html=(body.match(/<html\b/gi)||[]).length;
    const xmlDecl=/^\s*<\?xml/i.test(body);
    const contentType=r.headers.get('content-type')||'';
    const rssLike=/xml|rss/i.test(contentType) && (items+entries)>0;
    const ok=r.ok && rssLike;
    result.push({name,status:r.status,contentType,bytes:body.length,items,entries,channels,rss,html,xmlDecl,finalUrl:r.url,pass:ok});
    console.log(JSON.stringify(result.at(-1)));
  } catch(e) {
    result.push({name,error:e?.message||String(e),pass:false});
    console.log(JSON.stringify(result.at(-1)));
  }
}

const families = ['AI','Technology','Digital-Life'];
for (const family of families) {
  const pair=result.filter(x=>x.name.startsWith(family+'-'));
  const chosen=pair.find(x=>x.pass) || pair[0];
  console.log(JSON.stringify({family,selected:chosen?.name,selectedPass:chosen?.pass,primaryFailed:pair[0]?.pass===false,fallbackPass:pair[1]?.pass===true}));
}

const required=['AI','Technology','Digital-Life','Innovation','Product-Launches','Crypto'];
const okCount=required.filter(n=>result.some(x=>x.name===n+'-primary' && x.pass) || result.some(x=>x.name===n+'-fallback' && x.pass)).length;
console.log(`Bing fallback probe families: ${okCount}/${required.length} have at least one working RSS variant`);
if(okCount < required.length) process.exit(1);
