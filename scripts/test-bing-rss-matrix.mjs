const probes = [
  ['technology', 'https://www.bing.com/news/search?q=technology&format=RSS'],
  ['software', 'https://www.bing.com/news/search?q=software&format=RSS'],
  ['chips', 'https://www.bing.com/news/search?q=chips&format=RSS'],
  ['gadgets', 'https://www.bing.com/news/search?q=gadgets&format=RSS'],
  ['tech-news', 'https://www.bing.com/news/search?q=tech%20news&format=RSS'],
  ['technology-news', 'https://www.bing.com/news/search?q=technology%20news&format=RSS'],
  ['software-news', 'https://www.bing.com/news/search?q=software%20news&format=RSS'],
  ['consumer-tech', 'https://www.bing.com/news/search?q=consumer%20technology&format=RSS'],
];

let pass = 0;
for (const [name, url] of probes) {
  try {
    const r = await fetch(url, {redirect:'follow',signal:AbortSignal.timeout(10000),headers:{'user-agent':'TrendForgeBot/2.0 (+https://github.com/WebTooler/Trendforge)',accept:'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8'}});
    const body=await r.text();
    const items=(body.match(/<item\b/gi)||[]).length;
    const channels=(body.match(/<channel\b/gi)||[]).length;
    const rss=(body.match(/<rss\b/gi)||[]).length;
    const ok=r.ok && /xml|rss/i.test(r.headers.get('content-type')||'') && items>0 && channels>0;
    if(ok) pass++;
    console.log(JSON.stringify({name,status:r.status,contentType:r.headers.get('content-type'),bytes:body.length,items,channels,rss,finalUrl:r.url,pass:ok}));
  } catch(e){ console.log(JSON.stringify({name,error:e?.message||String(e),pass:false})); }
}
console.log(`Bing Technology query candidates: ${pass}/${probes.length} PASS`);
if(pass===0) process.exit(1);
