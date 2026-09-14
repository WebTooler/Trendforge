import fs from 'node:fs';

const briefPath = 'data/article-brief.json';
const articleDir = 'content/articles';
const outputPath = 'data/claim-verification.json';
const STOP = new Set(['about','after','again','also','been','being','could','from','have','into','more','most','over','said','some','than','that','their','there','these','they','this','what','when','which','with','will','would','your','technology','tech','digital','latest','news','update','updates','guide','how','today','artificial','intelligence','company','companies','industry','development','developments','according','reported']);
const tokenize = (text='') => new Set(text.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length >= 4 && !STOP.has(w)));
const cleanHtml = (html='') => html.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&#39;/gi,"'").replace(/&quot;/gi,'"').replace(/\s+/g,' ').trim();
const splitSentences = (text='') => text.replace(/\s+/g,' ').split(/(?<=[.!?])\s+(?=[A-Z0-9"“])/).map(s=>s.trim()).filter(s=>s.length >= 45 && s.length <= 420);
const factualClaim = (s) => /\b(is|are|was|were|has|have|had|will|can|cannot|announced|launched|released|reported|said|calls?|plans?|expects?|shows?|found|according|percent|%|million|billion|year|month|today|yesterday|202[0-9])\b/i.test(s) || /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/.test(s);
const normalizeUrl = (u) => { try { return new URL(u).toString(); } catch { return null; } };
async function fetchSource(url) {
  const started = Date.now();
  try {
    const r = await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(10000),headers:{'user-agent':'TrendForge-claim-verifier/1.0','accept':'text/html,application/xhtml+xml'}});
    const html = await r.text();
    return { ok:r.ok, status:r.status, finalUrl:r.url||url, latencyMs:Date.now()-started, text:cleanHtml(html).slice(0,250000) };
  } catch(e) { return {ok:false,status:0,finalUrl:url,latencyMs:Date.now()-started,text:'',error:e?.message||String(e)}; }
}
const evidenceScore = (claim, sourceText) => {
  const a = tokenize(claim); const b = tokenize(sourceText); const shared=[...a].filter(x=>b.has(x));
  const coverage = a.size ? shared.length/a.size : 0;
  const density = b.size ? shared.length/Math.min(a.size,80) : 0;
  return {score:Math.round(Math.min(100, coverage*75+density*25)), shared:shared.slice(0,20)};
};

if (!fs.existsSync(briefPath)) { console.log('No article brief; claim verification skipped.'); process.exit(0); }
const brief = JSON.parse(fs.readFileSync(briefPath,'utf8'));
const files = fs.existsSync(articleDir) ? fs.readdirSync(articleDir).filter(f=>f.endsWith('.md')).sort((a,b)=>fs.statSync(`${articleDir}/${b}`).mtimeMs-fs.statSync(`${articleDir}/${a}`).mtimeMs) : [];
if (!files.length) { console.log('No generated article; claim verification skipped.'); process.exit(0); }
const articlePath=`${articleDir}/${files[0]}`;
const raw=fs.readFileSync(articlePath,'utf8');
const body=raw.replace(/^---[\s\S]*?---/,'').replace(/^\s*##\s+Sources[\s\S]*$/i,'').trim();
const claims=splitSentences(body).filter(factualClaim).slice(0,30);
const sourceInputs=(brief.brief?.sources||[]).map(s=>({title:s.title||'',url:normalizeUrl(s.url),publishedAt:s.publishedAt||null})).filter(s=>s.url);
const sources=[];
for(const source of sourceInputs){ const result=await fetchSource(source.url); sources.push({...source,...result}); }
const usable=sources.filter(s=>s.ok&&s.text.length>200);
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
const pass=claims.length===0 || (usable.length>0 && unsupported===0 && unavailable===0 && average>=60);
const result={version:1,generatedAt:new Date().toISOString(),articlePath,sourceCount:sourceInputs.length,usableSourceCount:usable.length,claimCount:claims.length,verified,partial,unsupported,sourceUnavailable:unavailable,averageConfidence:average,pass,policy:{verifiedMin:65,partialMin:45,blockUnsupported:true,blockUnavailable:true,minimumAverageConfidence:60},sources:sources.map(({text,...s})=>s),claims:verifiedClaims};
fs.mkdirSync('data',{recursive:true});
fs.writeFileSync(outputPath,`${JSON.stringify(result,null,2)}\n`);
console.log(`Claim Verification v1: ${claims.length} claim(s) — ${verified} verified, ${partial} partial, ${unsupported} unsupported, ${unavailable} source-unavailable; average confidence ${average}; ${pass?'PASS':'BLOCK'}.`);
if(!pass) process.exit(1);
