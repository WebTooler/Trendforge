import { generateNativeArticle as generateV23 } from './trendforge-native-writer-v23.mjs';

const originalFetch = globalThis.fetch;
const clean = value => String(value || '').replace(/<!\[CDATA\[/g,'').replace(/\]\]>/g,'').replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&#(?:x2026;|8230;)/gi,'…').replace(/\s+/g,' ').trim();
const tokens = value => new Set(clean(value).toLowerCase().split(/[^a-z0-9]+/).filter(x=>x.length>3));
const overlap = (a,b) => { const A=tokens(a), B=tokens(b); return [...A].filter(x=>B.has(x)).length; };
const absolute = (href, base) => { try { return new URL(href, base).toString(); } catch { return ''; } };
const domainOf = value => { try { return new URL(value).hostname.replace(/^www\./,'').toLowerCase(); } catch { return ''; } };
const mirrors = new Set(['news.google.com','google.com','google.co.uk']);
const feedUrls = (html, base) => {
  const urls=[];
  for(const m of String(html).matchAll(/<link\b([^>]*?)>/gi)) {
    const tag=m[1]; if(!/alternate/i.test(tag)||!/(rss|atom|xml)/i.test(tag)) continue;
    const href=tag.match(/href=["']([^"']+)["']/i)?.[1]; if(href) urls.push(absolute(href,base));
  }
  try { const origin=new URL(base).origin; for(const p of ['/feed/','/feed','/rss/','/rss','/rss.xml','/feed.xml']) urls.push(origin+p); } catch {}
  return [...new Set(urls)].filter(Boolean).slice(0,6);
};
const parseRssItems = (xml, topic) => {
  const out=[];
  for(const m of String(xml).matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)) {
    const item=m[1];
    const title=clean((item.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||['',''])[1]);
    const rawDescription=(item.match(/<description[^>]*>([\s\S]*?)<\/description>/i)||['',''])[1];
    const direct=clean((item.match(/<link[^>]*>([\s\S]*?)<\/link>/i)||['',''])[1]);
    const sourceUrl=clean((item.match(/<source\b[^>]*url=["']([^"']+)["'][^>]*>/i)||['',''])[1]);
    const links=[];
    for(const a of rawDescription.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
      const url=absolute(a[1],'https://news.google.com'); const text=clean(a[2]);
      if(url&&text)links.push({url,text});
    }
    const score=overlap(topic,`${title} ${clean(rawDescription)}`);
    if(title&&score>=4)out.push({title,score,links,direct,sourceUrl});
  }
  return out.sort((a,b)=>b.score-a.score);
};
const parseFeedLinks = (xml,topic,excludeDomain) => {
  const out=[];
  for(const item of parseRssItems(xml,topic)) {
    for(const link of item.links) {
      const d=domainOf(link.url); if(!d||mirrors.has(d)||d===excludeDomain)continue;
      if(overlap(topic,`${item.title} ${link.text}`)>=4)out.push({url:link.url,title:item.title,score:item.score+overlap(topic,link.text)});
    }
    const d=domainOf(item.direct); if(d&&!mirrors.has(d)&&d!==excludeDomain)out.push({url:item.direct,title:item.title,score:item.score});
  }
  const seen=new Set(); return out.sort((a,b)=>b.score-a.score).filter(x=>{if(seen.has(x.url))return false;seen.add(x.url);return true;}).slice(0,6);
};

async function googleNewsRecovery(topic, excludeDomain) {
  try {
    const q=encodeURIComponent(topic);
    const r=await originalFetch(`https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`,{redirect:'follow',signal:AbortSignal.timeout(3500),headers:{'user-agent':'TrendForge-native-writer/2.4','accept':'application/rss+xml,application/xml,text/xml,*/*;q=0.5'}});
    if(!r.ok)return [];
    return parseFeedLinks(await r.text(),topic,excludeDomain);
  } catch { return []; }
}

async function recoverHomepage(response, requestUrl, topic) {
  if(!response?.ok || !topic) return response;
  const finalUrl=response.url||requestUrl;
  let parsed; try { parsed=new URL(finalUrl); } catch { return response; }
  const homepage=/^\/$/.test(parsed.pathname) || /\/(feed|rss)(\.xml)?\/?$/i.test(parsed.pathname);
  if(!homepage)return response;
  const html=await response.text();
  const excludeDomain=domainOf(finalUrl);

  const googleLinks=await googleNewsRecovery(topic,excludeDomain);
  if(googleLinks.length) {
    const body=googleLinks.map(x=>`<article><h2>${x.title}</h2><a href="${x.url}">${x.title}</a></article>`).join('\n');
    return new Response(`<html><head><title>${clean(topic)}</title></head><body>${body}</body></html>`,{status:200,headers:{'content-type':'text/html'}});
  }

  for(const feed of feedUrls(html,finalUrl)) {
    try {
      const r=await originalFetch(feed,{redirect:'follow',signal:AbortSignal.timeout(3000),headers:{'user-agent':'TrendForge-native-writer/2.4',accept:'application/rss+xml,application/atom+xml,application/xml,text/xml,*/*;q=0.5'}});
      if(!r.ok)continue;
      const matches=parseFeedLinks(await r.text(),topic,excludeDomain);
      if(matches.length) {
        const body=matches.map(x=>`<article><h2>${x.title}</h2><a href="${x.url}">${x.title}</a></article>`).join('\n');
        return new Response(`<html><head><title>${clean(topic)}</title></head><body>${body}</body></html>`,{status:200,headers:{'content-type':'text/html'}});
      }
    } catch {}
  }
  return new Response(html,{status:response.status,headers:response.headers});
}

globalThis.fetch = async (input, init) => {
  const response=await originalFetch(input,init);
  const topic=globalThis.__TREND_FORGE_NATIVE_TOPIC;
  if(typeof input==='string'&&topic)return recoverHomepage(response,input,topic);
  return response;
};

export async function generateNativeArticle({candidate,existingTitles=new Set()}) {
  globalThis.__TREND_FORGE_NATIVE_TOPIC=candidate?.title||'';
  try{return await generateV23({candidate,existingTitles});}
  finally{globalThis.__TREND_FORGE_NATIVE_TOPIC='';}
}
