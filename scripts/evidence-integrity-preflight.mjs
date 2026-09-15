import fs from 'node:fs';

const scoredPath='data/scored-trends.json';
const verificationPath='data/source-verification.json';
const outputPath='data/evidence-integrity.json';
const TIMEOUT=9000;
const MIN_TOPIC_OVERLAP=2;
const MIN_BODY_CHARS=500;
const ROOT_PATH_RE=/^\/?(?:index\.(?:html?|php)|home)?\/?$/i;
const MIRRORS=new Set(['news.google.com','google.com','google.co.uk','bing.com','www.bing.com']);
const blockedHosts=new Set(['facebook.com','reddit.com','pinterest.com','youtube.com','tiktok.com','x.com']);
const secondLevel=new Set(['co.uk','co.in','co.jp','co.nz','co.au','com.br','com.cn']);
const stop=new Set(['about','after','again','also','been','being','could','from','have','into','more','most','over','said','some','than','that','their','there','these','they','this','what','when','which','with','will','would','your','technology','tech','digital','latest','news','update','updates','guide','how','today','artificial','intelligence','company','companies','industry','development','developments','story','stories','article','articles','exclusive','report']);
const clean=(s='')=>String(s).replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/\s+/g,' ').trim();
const tokens=(s='')=>new Set(clean(s).toLowerCase().split(/[^a-z0-9]+/).filter(x=>x.length>=4&&!stop.has(x)));
const overlap=(a,b)=>{const A=tokens(a),B=tokens(b);return[...A].filter(x=>B.has(x)).length;};
const host=(u='')=>{try{return new URL(u).hostname.replace(/^www\./,'').toLowerCase();}catch{return '';}};
const family=(u='')=>{const h=host(u);if(!h)return '';const p=h.split('.');if(p.length<2)return h;const suffix=p.slice(-2).join('.');return secondLevel.has(suffix)&&p.length>=3?p.slice(-3).join('.'):suffix;};
const validUrl=(u='')=>{try{const x=new URL(u);const h=host(x.href);return x.protocol==='https:'&&!MIRRORS.has(h)&&!blockedHosts.has(h);}catch{return false;}};
const looksLikeHomepage=(u='')=>{try{const x=new URL(u);return !x.pathname||x.pathname==='/'||ROOT_PATH_RE.test(x.pathname)||x.pathname.length<8;}catch{return true;}};
const looksLikeFeed=(u='')=>{try{const x=new URL(u);return /^feeds?\./i.test(x.hostname)||/^rss\./i.test(x.hostname)||/^feed\./i.test(x.hostname)||/(^|\/)(rss|feed|feeds|atom|sitemap)(\/|\.|$)/i.test(x.pathname)||/(^|&)(feed|rss|atom|format)=/i.test(x.search.slice(1));}catch{return true;}};

async function fetchPage(url){try{const r=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(TIMEOUT),headers:{'user-agent':'Mozilla/5.0 (compatible; TrendForge-evidence-integrity/1.4)','accept':'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8','accept-language':'en-US,en;q=0.9'}});if(!r.ok||!validUrl(r.url||url))return null;const html=await r.text();const title=clean((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[,''])[1]);const h1=clean((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)||[,''])[1]);const desc=clean((html.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([\s\S]*?)["']/i)||[,''])[1]);const canonical=clean((html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)||[,''])[1]);const paragraphs=[...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map(m=>clean(m[1])).filter(x=>x.length>=45&&x.length<=3000).slice(0,120);const body=paragraphs.join(' ');return{url:r.url,title,h1,description:desc,canonical,body,bodyChars:body.length};}catch{return null;}}
function extractLinks(raw=''){const out=[];for(const m of String(raw).matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){try{const u=new URL(m[1]);if(u.protocol!=='https:'||MIRRORS.has(host(u.href)))continue;out.push({url:u.href,text:clean(m[2])});}catch{}}return out;}

async function recoverFromNewsFeed(title, feedUrl, resolvedFrom){
  try{
    const r=await fetch(feedUrl,{signal:AbortSignal.timeout(TIMEOUT),headers:{'user-agent':'TrendForge-evidence-integrity/1.4','accept':'application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.8'}});
    if(!r.ok)return[];
    const xml=await r.text();
    const items=[...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(m=>m[1]);
    const candidates=[];
    for(const item of items){
      const itemTitle=clean((item.match(/<title>([\s\S]*?)<\/title>/i)||[,''])[1]);
      const rawDescription=(item.match(/<description>([\s\S]*?)<\/description>/i)||[,''])[1];
      const description=clean(rawDescription);
      const itemOverlap=overlap(title,`${itemTitle} ${description}`);
      if(!itemTitle||itemOverlap<MIN_TOPIC_OVERLAP)continue;
      for(const l of extractLinks(rawDescription)){
        const d=host(l.url);if(!d||MIRRORS.has(d)||blockedHosts.has(d)||looksLikeHomepage(l.url)||looksLikeFeed(l.url))continue;
        candidates.push({url:l.url,discoveryTitle:itemTitle,discoveryDescription:description,score:itemOverlap+overlap(title,l.text),resolvedFrom:`${resolvedFrom}-description-link`});
      }
      const rawLink=clean((item.match(/<link>([\s\S]*?)<\/link>/i)||[,''])[1]);
      if(validUrl(rawLink)&&!looksLikeHomepage(rawLink)&&!looksLikeFeed(rawLink))candidates.push({url:rawLink,discoveryTitle:itemTitle,discoveryDescription:description,score:itemOverlap,resolvedFrom});
    }
    const seen=new Set();
    return candidates.sort((a,b)=>b.score-a.score).filter(c=>{if(seen.has(c.url))return false;seen.add(c.url);return true;}).slice(0,10);
  }catch{return[];}
}

async function newsRecovery(title){
  const query=encodeURIComponent(title);
  const feeds=[
    [`https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`,'google-news-recovery'],
    [`https://www.bing.com/news/search?q=${query}&format=rss`,'bing-news-recovery'],
  ];
  const all=[];
  for(const [url,kind] of feeds){
    const candidates=await recoverFromNewsFeed(title,url,kind);
    all.push(...candidates);
    if(all.length>=10)break;
  }
  const seen=new Set();
  return all.filter(c=>{if(seen.has(c.url))return false;seen.add(c.url);return true;}).slice(0,10);
}

async function validateSource(source,storyTitle){const supplied=source.finalUrl||source.url||'';const result={suppliedUrl:supplied,domain:host(supplied),publisherFamily:family(supplied),resolvedFrom:source.resolvedFrom||'seed',ok:false,reason:'unvalidated'};if(!validUrl(supplied)){result.reason='invalid-or-mirror-url';return result;}if(source.resolvedFrom==='publisher-url-fallback'||looksLikeHomepage(supplied)){result.reason='homepage-or-publisher-identity-url';return result;}if(looksLikeFeed(supplied)){result.reason='feed-or-index-url';return result;}const page=await fetchPage(supplied);if(!page){result.reason='unreachable-or-non-html';return result;}const identityText=[page.title,page.h1,page.description,source.discoveryTitle,source.discoveryDescription].filter(Boolean).join(' ');const identityOverlap=overlap(storyTitle,identityText);const discoveryOverlap=source.discoveryTitle?overlap(source.discoveryTitle,`${page.title} ${page.h1} ${page.description}`):0;const bodyOverlap=overlap(storyTitle,page.body);const discoveryBodyOverlap=source.discoveryTitle?overlap(source.discoveryTitle,page.body):0;const relevant=Math.max(identityOverlap,bodyOverlap,discoveryOverlap,discoveryBodyOverlap);result.finalUrl=page.url;result.pageTitle=page.title;result.canonical=page.canonical;result.bodyChars=page.bodyChars;result.topicOverlap=relevant;if(page.bodyChars<MIN_BODY_CHARS){result.reason='insufficient-article-body';return result;}if(relevant<MIN_TOPIC_OVERLAP){result.reason='page-topic-mismatch';return result;}result.ok=true;result.reason='story-relevant-publisher-article';result.discoveryTopicOverlap=discoveryOverlap||discoveryBodyOverlap;return result;}

if(!fs.existsSync(scoredPath)||!fs.existsSync(verificationPath)){console.log('Evidence integrity preflight skipped: required inputs missing.');process.exit(0);}
const scored=JSON.parse(fs.readFileSync(scoredPath,'utf8'));const verification=JSON.parse(fs.readFileSync(verificationPath,'utf8'));const records=new Map((verification.records||[]).map(r=>[r.link,r]));const report=[];let blocked=0;
for(const trend of scored.trends||[]){if(!trend.eligible){report.push({link:trend.link,title:trend.title,status:'not-eligible',sources:[]});continue;}const rec=records.get(trend.link);const raw=(rec?.sources||[]).filter(s=>s.ok&&s.resolvedFrom!=='publisher-url-fallback'&&!looksLikeHomepage(s.finalUrl||s.url||'')&&!looksLikeFeed(s.finalUrl||s.url||''));const checked=[];const seenUrls=new Set();for(const s of raw.slice(0,8)){const key=s.finalUrl||s.url;if(seenUrls.has(key))continue;seenUrls.add(key);checked.push(await validateSource(s,trend.title));}let valid=checked.filter(x=>x.ok);let recovery=[];if(valid.length<2){recovery=await newsRecovery(trend.title);for(const c of recovery){const candidateFamily=family(c.url);if(!candidateFamily||valid.some(v=>family(v.finalUrl||'')===candidateFamily))continue;const v=await validateSource({url:c.url,resolvedFrom:c.resolvedFrom,discoveryTitle:c.discoveryTitle,discoveryDescription:c.discoveryDescription},trend.title);if(v.ok){valid.push(v);checked.push(v);}if(valid.length>=6)break;}}
const byFamily=new Map();for(const v of valid){const f=family(v.finalUrl||'');if(f&&!byFamily.has(f))byFamily.set(f,v);}const independent=Array.from(byFamily.values());const domains=independent.map(x=>host(x.finalUrl||'')).filter(Boolean);const status=independent.length>=2?'pass':'block';if(status==='block'){blocked++;trend.eligible=false;trend.evidenceIntegrityBlocked=true;}else{trend.evidenceIntegrityPassed=true;}
report.push({link:trend.link,title:trend.title,status,validSourceCount:valid.length,independentPublisherCount:independent.length,independentPublisherFamilies:[...byFamily.keys()],independentDomains:domains,sources:checked,recoveryAttempts:recovery.length});}
fs.writeFileSync(scoredPath,JSON.stringify(scored,null,2)+'\n');fs.mkdirSync('data',{recursive:true});fs.writeFileSync(outputPath,JSON.stringify({version:5,generatedAt:new Date().toISOString(),minimumIndependentSources:2,minimumIndependentPublisherFamilies:2,minimumIndependentDomains:2,recoveryProviders:['google-news','bing-news'],report},null,2)+'\n');
console.log(`Evidence Integrity Preflight v5: ${report.filter(x=>x.status==='pass').length} eligible candidate(s) passed, ${blocked} blocked before AI.`);
console.log('Policy: exact publisher article pages only; feed/index/homepage URLs rejected; same publisher subdomains are not independent; Google/Bing News are recovery/index only; minimum 2 independent publisher families.');
