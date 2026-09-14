import { generateNativeArticle as generateV23 } from './trendforge-native-writer-v23.mjs';

const originalFetch = globalThis.fetch;
const clean = value => String(value || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/\s+/g, ' ').trim();
const tokens = value => new Set(clean(value).toLowerCase().split(/[^a-z0-9]+/).filter(x => x.length > 3));
const overlap = (a,b) => { const A=tokens(a), B=tokens(b); return [...A].filter(x=>B.has(x)).length; };
const absolute = (href, base) => { try { return new URL(href, base).toString(); } catch { return ''; } };
const feedUrls = (html, base) => {
  const urls=[];
  for(const m of String(html).matchAll(/<link\b([^>]*?)>/gi)) {
    const tag=m[1]; if(!/alternate/i.test(tag)||!/(rss|atom|xml)/i.test(tag)) continue;
    const href=tag.match(/href=["']([^"']+)["']/i)?.[1]; if(href) urls.push(absolute(href,base));
  }
  try { const origin=new URL(base).origin; for(const p of ['/feed/','/feed','/rss/','/rss','/rss.xml','/feed.xml']) urls.push(origin+p); } catch {}
  return [...new Set(urls)].filter(Boolean).slice(0,4);
};
const articleLinks = (xml, topic) => {
  const out=[];
  for(const m of String(xml).matchAll(/<(?:item|entry)\b[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi)) {
    const item=m[1];
    const title=clean((item.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||['',''])[1]);
    const direct=clean((item.match(/<link[^>]*>([\s\S]*?)<\/link>/i)||['',''])[1]);
    const href=clean((item.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i)||['',''])[1]);
    const url=absolute(direct||href,'https://example.com');
    const score=overlap(topic,title);
    if(url&&title&&score>=4) out.push({url,title,score});
  }
  return out.sort((a,b)=>b.score-a.score).slice(0,3);
};

async function recoverHomepage(response, requestUrl, topic) {
  if(!response?.ok || !topic) return response;
  const finalUrl=response.url||requestUrl;
  let parsed; try { parsed=new URL(finalUrl); } catch { return response; }
  const homepage=/^\/$/.test(parsed.pathname) || /\/(feed|rss)(\.xml)?\/?$/i.test(parsed.pathname);
  if(!homepage) return response;
  const html=await response.text();
  for(const feed of feedUrls(html,finalUrl)) {
    try {
      const r=await originalFetch(feed,{redirect:'follow',signal:AbortSignal.timeout(3000),headers:{'user-agent':'TrendForge-native-writer/2.4',accept:'application/rss+xml,application/atom+xml,application/xml,text/xml,*/*;q=0.5'}});
      if(!r.ok) continue;
      const matches=articleLinks(await r.text(),topic);
      if(matches.length) {
        const chosen=matches[0];
        const synthetic=`<html><head><title>${chosen.title}</title></head><body><a href="${chosen.url}">${chosen.title}</a></body></html>`;
        return new Response(synthetic,{status:200,headers:{'content-type':'text/html'}});
      }
    } catch {}
  }
  return new Response(html,{status:response.status,headers:response.headers});
}

globalThis.fetch = async (input, init) => {
  const response=await originalFetch(input,init);
  const topic=globalThis.__TREND_FORGE_NATIVE_TOPIC;
  if(typeof input === 'string' && topic) return recoverHomepage(response,input,topic);
  return response;
};

export async function generateNativeArticle({ candidate, existingTitles = new Set() }) {
  globalThis.__TREND_FORGE_NATIVE_TOPIC = candidate?.title || '';
  try { return await generateV23({ candidate, existingTitles }); }
  finally { globalThis.__TREND_FORGE_NATIVE_TOPIC = ''; }
}
