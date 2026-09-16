import fs from 'node:fs';

const scoredPath = 'data/scored-trends.json';
const verificationPath = 'data/source-verification.json';
const outputPath = 'data/evidence-integrity.json';
const TIMEOUT = 9000;
const MIN_TOPIC_OVERLAP = 2;
const MIN_BODY_CHARS = 500;
const ROOT_PATH_RE = /^\/?(?:index\.(?:html?|php)|home)?\/?$/i;
const MIRRORS = new Set(['news.google.com', 'google.com', 'google.co.uk', 'bing.com', 'www.bing.com']);
const blockedHosts = new Set(['facebook.com','reddit.com','pinterest.com','youtube.com','tiktok.com','x.com']);
const secondLevel = new Set(['co.uk','co.in','co.jp','co.nz','co.au','com.br','com.cn']);
const stop = new Set(['about','after','again','also','been','being','could','from','have','into','more','most','over','said','some','than','that','their','there','these','they','this','what','when','which','with','will','would','your','technology','tech','digital','latest','news','update','updates','guide','how','today','artificial','intelligence','company','companies','industry','development','developments','story','stories','article','articles','exclusive','report']);

const clean = (s = '') => String(s).replace(/<!\[CDATA\[/gi,' ').replace(/\]\]>/gi,' ').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;|&#x27;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/\s+/g,' ').trim();
const decode = (s = '') => String(s).replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;|&#x27;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&nbsp;|&#160;/gi,' ');
const tokens = (s = '') => new Set(clean(s).toLowerCase().split(/[^a-z0-9]+/).filter(x => x.length >= 4 && !stop.has(x)));
const overlap = (a,b) => { const A=tokens(a), B=tokens(b); return [...A].filter(x=>B.has(x)).length; };
const host = (u='') => { try { return new URL(u).hostname.replace(/^www\./,'').toLowerCase(); } catch { return ''; } };
const family = (u='') => { const h=host(u); if(!h)return ''; const p=h.split('.'); if(p.length<2)return h; const suffix=p.slice(-2).join('.'); return secondLevel.has(suffix)&&p.length>=3?p.slice(-3).join('.'):suffix; };
const validUrl = (u='') => { try { const x=new URL(u); const h=host(x.href); return x.protocol==='https:'&&!MIRRORS.has(h)&&!blockedHosts.has(h); } catch { return false; } };
const looksLikeHomepage = (u='') => { try { const x=new URL(u); return !x.pathname||x.pathname==='/'||ROOT_PATH_RE.test(x.pathname)||x.pathname.length<8; } catch { return true; } };
const looksLikeFeed = (u='') => { try { const x=new URL(u); return /^feeds?\.|^rss\.|^feed\./i.test(x.hostname)||/(^|\/)(rss|feed|feeds|atom|sitemap)(\/|\.|$)/i.test(x.pathname)||/(^|&)(feed|rss|atom|format)=/i.test(x.search.slice(1)); } catch { return true; } };

async function fetchPage(url) {
  try {
    const r=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(TIMEOUT),headers:{'user-agent':'Mozilla/5.0 (compatible; TrendForge-evidence-integrity/2.0)','accept':'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8','accept-language':'en-US,en;q=0.9'}});
    if(!r.ok||!validUrl(r.url||url))return null;
    const html=await r.text();
    const title=clean((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[,''])[1]);
    const h1=clean((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)||[,''])[1]);
    const desc=clean((html.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([\s\S]*?)["']/i)||[,''])[1]);
    const canonical=clean((html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)||[,''])[1]);
    const paragraphs=[...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map(m=>clean(m[1])).filter(x=>x.length>=45&&x.length<=3000).slice(0,120);
    const body=paragraphs.join(' ');
    return {url:r.url,title,h1,description:desc,canonical,body,bodyChars:body.length};
  } catch { return null; }
}

function extractLinks(raw='') {
  const out=[]; const decoded=decode(raw);
  for(const m of String(decoded).matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    try { const u=new URL(decode(m[1])); if(u.protocol!=='https:')continue; const h=host(u.href); if(!h||MIRRORS.has(h)||blockedHosts.has(h)||looksLikeHomepage(u.href)||looksLikeFeed(u.href))continue; out.push({url:u.href,text:clean(m[2])}); } catch {}
  }
  return out;
}

async function newsRecovery(title) {
  const out=[];
  for(const q of [title,[...tokens(title)].slice(0,8).join(' ')]) {
    if(!q)continue;
    const encoded=encodeURIComponent(q);
    for(const [url,kind] of [[`https://news.google.com/rss/search?q=${encoded}&hl=en-US&gl=US&ceid=US:en`,'google-news-recovery'],[`https://www.bing.com/news/search?q=${encoded}&format=rss`,'bing-news-recovery']]) {
      try {
        const r=await fetch(url,{signal:AbortSignal.timeout(TIMEOUT),headers:{'user-agent':'TrendForge-evidence-integrity/2.0','accept':'application/rss+xml,application/atom+xml,application/xml,text/xml;q=0.9,*/*;q=0.8'}});
        if(!r.ok)continue;
        const xml=await r.text();
        const blocks=[...[...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map(m=>m[0]),...[...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)].map(m=>m[0])];
        for(const block of blocks){
          const itemTitle=clean((block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[,''])[1]);
          const rawDescription=(block.match(/<(?:description|summary|content)(?:\s[^>]*)?>([\s\S]*?)<\/(?:description|summary|content)>/i)||[,''])[1];
          const description=clean(rawDescription); const itemOverlap=overlap(title,`${itemTitle} ${description}`); if(!itemTitle||itemOverlap<MIN_TOPIC_OVERLAP)continue;
          const urls=[];
          for(const m of block.matchAll(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/gi))urls.push(m[1]);
          const textLink=(block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)||[,''])[1]; if(textLink)urls.push(textLink);
          for(const l of extractLinks(rawDescription))urls.push(l.url);
          for(const candidate of [...new Set(urls)]){
            if(!validUrl(candidate)||looksLikeHomepage(candidate)||looksLikeFeed(candidate))continue;
            out.push({url:candidate,discoveryTitle:itemTitle,discoveryDescription:description,score:itemOverlap,resolvedFrom:kind});
          }
        }
      } catch {}
      if(out.length>=12)break;
    }
    if(out.length>=12)break;
  }
  return out.slice(0,12);
}

async function validateSource(source, storyTitle) {
  const supplied=source.finalUrl||source.url||'';
  const result={suppliedUrl:supplied,domain:host(supplied),publisherFamily:family(supplied),resolvedFrom:source.resolvedFrom||'seed',ok:false,reason:'unvalidated'};
  if(!validUrl(supplied)){result.reason='invalid-or-mirror-url';return result;}
  if(source.resolvedFrom==='publisher-url-fallback'||looksLikeHomepage(supplied)){result.reason='homepage-or-publisher-identity-url';return result;}
  if(looksLikeFeed(supplied)){result.reason='feed-or-index-url';return result;}
  const page=await fetchPage(supplied); if(!page){result.reason='unreachable-or-non-html';return result;}
  const identityText=[page.title,page.h1,page.description,source.discoveryTitle,source.discoveryDescription].filter(Boolean).join(' ');
  const relevant=Math.max(overlap(storyTitle,identityText),overlap(storyTitle,page.body),source.discoveryTitle?overlap(source.discoveryTitle,`${page.title} ${page.h1} ${page.description}`):0,source.discoveryTitle?overlap(source.discoveryTitle,page.body):0);
  result.finalUrl=page.url; result.pageTitle=page.title; result.canonical=page.canonical; result.bodyChars=page.bodyChars; result.topicOverlap=relevant;
  if(page.bodyChars<MIN_BODY_CHARS){result.reason='insufficient-article-body';return result;}
  if(relevant<MIN_TOPIC_OVERLAP){result.reason='page-topic-mismatch';return result;}
  result.ok=true; result.reason='story-relevant-publisher-article'; return result;
}

if(!fs.existsSync(scoredPath)||!fs.existsSync(verificationPath)){console.log('Evidence integrity preflight skipped: required inputs missing.');process.exit(0);}
const scored=JSON.parse(fs.readFileSync(scoredPath,'utf8'));
const verification=JSON.parse(fs.readFileSync(verificationPath,'utf8'));
const records=new Map((verification.records||[]).map(r=>[r.link,r]));
const report=[]; let blocked=0;
for(const trend of scored.trends||[]) {
  if(!trend.eligible){report.push({link:trend.link,title:trend.title,status:'not-eligible',sources:[]});continue;}
  const rec=records.get(trend.link);
  const raw=(rec?.sources||[]).filter(s=>s.ok&&s.resolvedFrom!=='publisher-url-fallback'&&!looksLikeHomepage(s.finalUrl||s.url||'')&&!looksLikeFeed(s.finalUrl||s.url||''));
  const checked=[]; const seenUrls=new Set();
  for(const s of raw.slice(0,8)){const key=s.finalUrl||s.url;if(seenUrls.has(key))continue;seenUrls.add(key);checked.push(await validateSource(s,trend.title));}
  let valid=checked.filter(x=>x.ok); let recovery=[];
  if(valid.length<2){recovery=await newsRecovery(trend.title);for(const c of recovery){const candidateFamily=family(c.url);if(!candidateFamily||valid.some(v=>family(v.finalUrl||'')===candidateFamily))continue;const v=await validateSource(c,trend.title);if(v.ok){valid.push(v);checked.push(v);}if(valid.length>=6)break;}}
  const byFamily=new Map(); for(const v of valid){const f=family(v.finalUrl||'');if(f&&!byFamily.has(f))byFamily.set(f,v);}
  const independent=[...byFamily.values()]; const domains=independent.map(x=>host(x.finalUrl||'')).filter(Boolean); const status=independent.length>=2?'pass':'block';
  if(status==='block'){blocked++;} else { /* keep scored eligibility untouched; this artifact is the authoritative evidence gate */ }
  report.push({link:trend.link,title:trend.title,status,validSourceCount:valid.length,independentPublisherCount:independent.length,independentPublisherFamilies:[...byFamily.keys()],independentDomains:domains,sources:checked,recoveryAttempts:recovery.length});
}
fs.mkdirSync('data',{recursive:true});
fs.writeFileSync(outputPath,JSON.stringify({version:6,generatedAt:new Date().toISOString(),minimumIndependentSources:2,minimumIndependentPublisherFamilies:2,minimumIndependentDomains:2,recoveryProviders:['google-news','bing-news'],report},null,2)+'\n');
console.log(`Evidence Integrity Preflight v6: ${report.filter(x=>x.status==='pass').length} eligible candidate(s) passed, ${blocked} blocked before AI.`);
console.log('Policy: exact publisher article pages only; feed/index/homepage URLs rejected; same publisher subdomains are not independent; Google/Bing News are recovery/index only; minimum 2 independent publisher families.');
console.log('Eligibility handoff: research eligibility is preserved; evidence integrity is carried only by data/evidence-integrity.json.');
