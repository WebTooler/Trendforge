import { fetch } from 'undici';

const urls = [
  ['AI', 'https://www.bing.com/news/search?q=AI&format=RSS'],
  ['AI-first', 'https://www.bing.com/news/search?q=AI&setmkt=en-US&first=1&format=RSS'],
  ['AI-count', 'https://www.bing.com/news/search?q=AI&setmkt=en-US&first=1&count=30&format=RSS'],
];

function tag(xml, name) {
  const m = xml.match(new RegExp('<'+name+'>([\\s\\S]*?)</'+name+'>', 'i'));
  return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g,'').trim() : '';
}
function items(xml) { return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(m=>m[1]); }
function cleanLink(v) {
  const s=v.replace(/&amp;/g,'&');
  try {
    const u=new URL(s);
    if (u.hostname==='www.bing.com' && u.pathname==='/news/apiclick.aspx') return u.searchParams.get('url') || s;
  } catch {}
  return s;
}
for (const [name,url] of urls) {
  const r=await fetch(url,{headers:{accept:'application/rss+xml, application/xml;q=0.9, */*;q=0.8'}});
  const xml=await r.text();
  const its=items(xml);
  console.log(JSON.stringify({name,status:r.status,contentType:r.headers.get('content-type'),bytes:xml.length,itemCount:its.length,channelTitle:tag(xml,'title'),sample:its.slice(0,3).map(x=>({title:tag(x,'title'),link:cleanLink(tag(x,'link')),source:tag(x,'News:Source'),pubDate:tag(x,'pubDate'),description:tag(x,'description').slice(0,220)}))}));
}
