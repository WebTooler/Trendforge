const probes = [
  ['AI-production', 'https://www.bing.com/news/search?q=AI&count=30&format=RSS'],
  ['Technology-production', 'https://www.bing.com/news/search?q=technology&count=30&format=RSS'],
  ['Digital-Life-production', 'https://www.bing.com/news/search?q=privacy&count=30&format=RSS'],
  ['Innovation-production', 'https://www.bing.com/news/search?q=innovation&count=30&format=RSS'],
  ['Product-Launches-production', 'https://www.bing.com/news/search?q=product%20launch&count=30&format=RSS'],
  ['Crypto-production', 'https://www.bing.com/news/search?q=crypto&count=30&format=RSS'],
];

let pass = 0;
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
    const technologyShape=name.startsWith('Technology') ? body.slice(0,1200).replace(/\s+/g,' ').trim() : undefined;
    const ok=r.ok && /xml/i.test(r.headers.get('content-type')||'') && (items+entries)>0;
    if(ok) pass++;
    console.log(JSON.stringify({name,status:r.status,contentType:r.headers.get('content-type'),bytes:body.length,items,entries,channels,rss,html,xmlDecl,finalUrl:r.url,pass:ok,technologyShape}));
  } catch(e) {
    console.log(JSON.stringify({name,error:e?.message||String(e),pass:false}));
  }
}
console.log(`Bing production RSS probes: ${pass}/${probes.length} PASS`);
if (pass !== probes.length) process.exit(1);
