import fs from 'node:fs';

const briefPath = 'data/article-brief.json';
const nativeMarkerPath = 'data/native-writer-published.json';
const articleDir = 'content/articles';
const outputPath = 'data/claim-verification.json';
const STOP = new Set(['about','after','again','also','been','being','could','from','have','into','more','most','over','said','some','than','that','their','there','these','they','this','what','when','which','with','will','would','your','technology','tech','digital','latest','news','update','updates','guide','how','today','artificial','intelligence','company','companies','industry','development','developments','according','reported']);
const tokenize = (text='') => new Set(text.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length >= 4 && !STOP.has(w)));
const cleanHtml = (html='') => html.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&#39;/gi,"'").replace(/&quot;/gi,'"').replace(/&#x27;/gi,"'").replace(/&#x2F;/gi,'/').replace(/\s+/g,' ').trim();
const decodeEntities = (text='') => cleanHtml(text).replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16)));
const splitSentences = (text='') => text.replace(/\s+/g,' ').split(/(?<=[.!?])\s+(?=[A-Z0-9"“])/).map(s=>s.trim()).filter(s=>s.length >= 45 && s.length <= 420);
const factualClaim = (s) => /\b(is|are|was|were|has|have|had|will|can|cannot|announced|launched|released|reported|said|calls?|plans?|expects?|shows?|found|according|percent|%|million|billion|year|month|today|yesterday|202[0-9])\b/i.test(s) || /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/.test(s);
const normalizeUrl = (u) => { try { return new URL(u).toString(); } catch { return null; } };
const isGoogleNews = (u='') => { try { const x=new URL(u); return x.hostname === 'news.google.com' && x.pathname.includes('/rss/articles/'); } catch { return false; } };

async function request(url, accept='text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8') {
  return fetch(url,{redirect:'follow',signal:AbortSignal.timeout(10000),headers:{'user-agent':'Mozilla/5.0 (compatible; TrendForge-claim-verifier/1.3)','accept':accept,'accept-language':'en-US,en;q=0.9'}});
}

async function fetchGoogleNewsFallback(source) {
  const query = encodeURIComponent(source.title.replace(/\s+-\s+[^-]+$/,'').slice(0,180));
  const rssUrl = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;
  try {
    const r = await request(rssUrl,'application/rss+xml,application/xml,text/xml,*/*;q=0.8');
    if (!r.ok) return null;
    const xml = await r.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(m=>m[1]);
    const target = source.title.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
    const words = new Set(target.split(' ').filter(w=>w.length>3));
    const ranked = items.map(item=>{
      const title = decodeEntities(item.match(/<title>([\s\S]*?)<\/title>/i)?.[1]||'');
      const description = decodeEntities(item.match(/<description>([\s\S]*?)<\/description>/i)?.[1]||'');
      const tw = new Set(title.toLowerCase().replace(/[^a-z0-9]+/g,' ').split(' ').filter(w=>w.length>3));
      return {title,description,score:[...words].filter(w=>tw.has(w)).length};
    }).sort((a,b)=>b.score-a.score)[0];
    if (!ranked || ranked.score < 2) return null;
    const text = `${ranked.title}. ${ranked.description}`.trim();
    return text.length > 120 ? {text,finalUrl:rssUrl,via:'google-news-rss-fallback'} : null;
  } catch { return null; }
}

async function fetchSource(source) {
  const started = Date.now();
  const originalUrl = source.url;
  try {
    const r = await request(originalUrl);
    const html = await r.text();
    const text = cleanHtml(html).slice(0,250000);
    if (r.ok && text.length > 500 && !isGoogleNews(originalUrl)) return {ok:true,status:r.status,finalUrl:r.url||originalUrl,latencyMs:Date.now()-started,text,via:'direct'};
    if (isGoogleNews(originalUrl)) {
      const fallback = await fetchGoogleNewsFallback(source);
      if (fallback) return {ok:true,status:r.status,finalUrl:fallback.finalUrl,latencyMs:Date.now()-started,text:fallback.text,via:fallback.via};
    }
    if (r.ok && text.length > 200) return {ok:true,status:r.status,finalUrl:r.url||originalUrl,latencyMs:Date.now()-started,text,via:'direct-short'};
    return {ok:false,status:r.status,finalUrl:r.url||originalUrl,latencyMs:Date.now()-started,text:'',error:`Source returned ${r.status} with insufficient readable content`};
  } catch(e) {
    if (isGoogleNews(originalUrl)) {
      const fallback = await fetchGoogleNewsFallback(source);
      if (fallback) return {ok:true,status:200,finalUrl:fallback.finalUrl,latencyMs:Date.now()-started,text:fallback.text,via:fallback.via};
    }
    return {ok:false,status:0,finalUrl:originalUrl,latencyMs:Date.now()-started,text:'',error:e?.message||String(e)};
  }
}

const evidenceScore = (claim, sourceText) => {
  const a = tokenize(claim); const b = tokenize(sourceText); const shared=[...a].filter(x=>b.has(x));
  const coverage = a.size ? shared.length/a.size : 0;
  const density = b.size ? shared.length/Math.min(a.size,80) : 0;
  return {score:Math.round(Math.min(100,coverage*75+density*25)),shared:shared.slice(0,20)};
};

if (!fs.existsSync(briefPath) && !fs.existsSync(nativeMarkerPath)) { console.log('No article brief or native publication marker; claim verification skipped.'); process.exit(0); }
const brief = fs.existsSync(briefPath) ? JSON.parse(fs.readFileSync(briefPath,'utf8')) : { brief: {} };
const nativePublished = fs.existsSync(nativeMarkerPath) ? JSON.parse(fs.readFileSync(nativeMarkerPath,'utf8')) : null;
const files = fs.existsSync(articleDir) ? fs.readdirSync(articleDir).filter(f=>f.endsWith('.md')).sort((a,b)=>fs.statSync(`${articleDir}/${b}`).mtimeMs-fs.statSync(`${articleDir}/${a}`).mtimeMs) : [];
if (!files.length) { console.log('No generated article; claim verification skipped.'); process.exit(0); }
const articlePath=`${articleDir}/${files[0]}`;
const raw=fs.readFileSync(articlePath,'utf8');
const frontmatterTitle=(raw.match(/^---[\s\S]*?\n(?:title|headline):\s*["']?(.+?)["']?\s*\n[\s\S]*?---/i)?.[1]||'').trim();
const briefSourceTitle=(brief.brief?.title||'').trim();
const nativeSourceTitle=(nativePublished?.candidate?.title||'').trim();
const nativeArticleSlug=String(nativePublished?.candidate?.title||'').replace(/\s+-\s+[^-]+$/,'').trim();
const articleTitleTokens=tokenize(frontmatterTitle);
const briefTitleTokens=tokenize(briefSourceTitle);
const nativeTitleTokens=tokenize(nativeArticleSlug || nativeSourceTitle);
const titleOverlap=[...articleTitleTokens].filter(x=>briefTitleTokens.has(x)).length;
const nativeTitleOverlap=[...articleTitleTokens].filter(x=>nativeTitleTokens.has(x)).length;
const isNativeCurrentArticle=Boolean(nativePublished && nativeTitleOverlap >= 2 && frontmatterTitle);
if (frontmatterTitle && briefSourceTitle && titleOverlap < 2 && !isNativeCurrentArticle) {
  console.log(`No matching generated article for current brief; latest article is '${frontmatterTitle}'. Claim verification skipped safely.`);
  fs.writeFileSync(outputPath,JSON.stringify({version:3,generatedAt:new Date().toISOString(),status:'skipped_no_matching_generated_article',articlePath,articleTitle:frontmatterTitle,briefTitle:briefSourceTitle},null,2)+'\n');
  process.exit(0);
}
const body=raw.replace(/^---[\s\S]*?---/,'').replace(/^\s*##\s+Sources[\s\S]*$/i,'').trim();
const claims=splitSentences(body).filter(factualClaim).slice(0,30);
const sourceSection=raw.match(/##\s+Sources\s*\n([\s\S]*?)(?:\n##\s|$)/i)?.[1]||'';
const articleSources=[...sourceSection.matchAll(/-\s+\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g)].map(m=>({title:m[1],url:normalizeUrl(m[2]),publishedAt:null})).filter(s=>s.url);
const briefSources=(brief.brief?.sources||[]).map(s=>({title:s.title||'',url:normalizeUrl(s.url),publishedAt:s.publishedAt||null})).filter(s=>s.url);
const sourceInputs=isNativeCurrentArticle ? articleSources : briefSources;
const sources=[];
for(const source of sourceInputs){ const result=await fetchSource(source); sources.push({...source,...result}); }
const usable=sources.filter(s=>s.ok&&s.text.length>120);
const verifiedClaims=claims.map((claim,index)=>{
  const matches=usable.map(s=>({source:s.url,title:s.title,...evidenceScore(claim,s.text)})).sort((a,b)=>b.score-a.score);
  const best=matches[0];
  const status=!best?'source_unavailable':best.score>=65?'verified':best.score>=45?'partial':'unsupported';
  return {id:index+1,claim,status,confidence:best?.score||0,bestSource:best?.source||null,sharedTerms:best?.shared||[]};
});
const verified=verifiedClaims.filter(c=>c.status==='verified').length;
const partial=verifiedClaims.filter(c=>c.status==='partial').length;
const unsupported=verifiedClaims.filter(c=>c.status==='unsupported').length;
const unavailable=verifiedClaims.filter(c=>c.status==='source_unavailable').length;
const average=verifiedClaims.length?Math.round(verifiedClaims.reduce((n,c)=>n+c.confidence,0)/verifiedClaims.length):0;
const pass=claims.length===0 || (usable.length>0&&unsupported===0&&unavailable===0&&average>=60);
const result={version:3,generatedAt:new Date().toISOString(),articlePath,verificationMode:isNativeCurrentArticle?'native-publication-sources':'brief-sources',sourceCount:sourceInputs.length,usableSourceCount:usable.length,claimCount:claims.length,verified,partial,unsupported,sourceUnavailable:unavailable,averageConfidence:average,pass,policy:{verifiedMin:65,partialMin:45,blockUnsupported:true,blockUnavailable:true,minimumAverageConfidence:60},sources:sources.map(({text,...s})=>s),claims:verifiedClaims};
fs.mkdirSync('data',{recursive:true});
fs.writeFileSync(outputPath,`${JSON.stringify(result,null,2)}\n`);
console.log(`Claim Verification v3: ${claims.length} claim(s) — ${verified} verified, ${partial} partial, ${unsupported} unsupported, ${unavailable} source-unavailable; average confidence ${average}; ${pass?'PASS':'BLOCK'} (${isNativeCurrentArticle?'native publication sources':'brief sources'}).`);
if(!pass) process.exit(1);
