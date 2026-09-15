import fs from 'node:fs';

const briefPath='data/article-brief.json';
const nativeMarkerPath='data/native-writer-published.json';
const verificationPath='data/source-verification.json';
const articleDir='content/articles';
const outputPath='data/claim-verification.json';
const STOP=new Set(['about','after','again','also','been','being','could','from','have','into','more','most','over','said','some','than','that','their','there','these','they','this','what','when','which','with','will','would','your','technology','tech','digital','latest','news','update','updates','guide','how','today','artificial','intelligence','company','companies','industry','development','developments','according','reported','reports','working','works']);
const ALIAS=new Map([
  ['bitcoin','btc'],['bitcoins','btc'],['ethereum','eth'],['ether','eth'],['cryptocurrency','crypto'],['cryptocurrencies','crypto'],
  ['declined','fall'],['declines','fall'],['dropped','fall'],['drops','fall'],['fell','fall'],['gained','rise'],['gains','rise'],['increased','rise'],['increases','rise'],['rose','rise'],
  ['rate-hike','rate'],['rate-hikes','rate'],['regulator','regulatory'],['regulators','regulatory'],['watchdog','regulatory'],['authority','regulatory'],['authorities','regulatory'],
  ['probe','investigation'],['probes','investigation'],['inquiry','investigation'],['inquiries','investigation'],['investigating','investigation'],['escalated','escalate'],['expanded','escalate'],['intensified','escalate'],
  ['warranty','guarantee'],['warranties','guarantee'],['terms','conditions'],['term','conditions'],['customers','consumer'],['customer','consumer'],
  ['announced','announce'],['announces','announce'],['launches','launch'],['launched','launch'],['released','release'],['releases','release']
]);
const normalizeToken=w=>{const x=String(w).toLowerCase();return ALIAS.get(x)||x.replace(/(ing|ed|es|s)$/,'')||x;};
const tokenize=(text='')=>new Set(String(text).toLowerCase().split(/[^a-z0-9.-]+/).map(normalizeToken).filter(w=>w.length>=3&&!STOP.has(w)));
const cleanHtml=(html='')=>String(html).replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<noscript[\s\S]*?<\/noscript>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&#39;|&apos;/gi,"'").replace(/&quot;/gi,'"').replace(/&#x27;/gi,"'").replace(/&#x2F;/gi,'/').replace(/\s+/g,' ').trim();
const splitSentences=(text='')=>String(text).replace(/\s+/g,' ').split(/(?<=[.!?])\s+(?=[A-Z0-9"“])/).map(s=>s.trim()).filter(s=>s.length>=35&&s.length<=500);
const factualClaim=s=>{const x=String(s).trim();if(/^(the move|this move|this development|the development|the change|the situation|that could|this could|it could|it may|this may)\b/i.test(x))return false;return /\b(announced|launch(?:ed|es)?|released|reported|said|plans?|expects?|found|shows?|calls?|proposed|approved|blocked|investigation|probe|inquiry|regulator|regulatory|warranty|terms|price|percent|%|million|billion|year|month|today|yesterday|202[0-9])\b/i.test(x)||/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/.test(x);};
const normalizeUrl=u=>{try{return new URL(u).toString();}catch{return null;}};
const isGoogleNews=u=>{try{return new URL(u).hostname==='news.google.com';}catch{return false;}};
const domainOf=u=>{try{return new URL(u).hostname.replace(/^www\./,'').toLowerCase();}catch{return '';}};
const topicScore=(a,b)=>{const A=tokenize(a),B=tokenize(b);return [...A].filter(x=>B.has(x)).length;};
const ngrams=(text,n=2)=>{const a=[...tokenize(text)],out=new Set();for(let i=0;i<=a.length-n;i++)out.add(a.slice(i,i+n).join(' '));return out;};
const numbers=(text='')=>new Set((String(text).match(/\b\d+(?:\.\d+)?%?\b/g)||[]).map(x=>x.toLowerCase()));

async function request(url){return fetch(url,{redirect:'follow',signal:AbortSignal.timeout(10000),headers:{'user-agent':'Mozilla/5.0 (compatible; TrendForge-claim-verifier/5.0)','accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8','accept-language':'en-US,en;q=0.9'}});}
async function fetchSource(source){const started=Date.now();try{const r=await request(source.url);const html=await r.text();const title=(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();const description=(html.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([\s\S]*?)["']/i)?.[1]||'').replace(/\s+/g,' ').trim();const text=cleanHtml(html).slice(0,350000);const finalUrl=normalizeUrl(r.url||source.url)||source.url;if(r.ok&&!isGoogleNews(finalUrl)&&text.length>500)return{...source,ok:true,status:r.status,finalUrl,latencyMs:Date.now()-started,text,title:title||source.title||'',description,via:'direct'};return{...source,ok:false,status:r.status,finalUrl,latencyMs:Date.now()-started,text:'',title:title||source.title||'',description,error:'source unavailable or not a direct publisher article'};}catch(e){return{...source,ok:false,status:0,finalUrl:source.url,latencyMs:Date.now()-started,text:'',title:source.title||'',description:'',error:e?.message||String(e)};}}

function evidenceUnits(source){const units=[];if(source.title)units.push({text:source.title,kind:'title'});if(source.description)units.push({text:source.description,kind:'description'});const sentences=splitSentences(source.text||'');for(const s of sentences.slice(0,220))units.push({text:s,kind:'sentence'});return units;}
function evidenceScore(claim,source){
  const claimTokens=tokenize(claim);const claimNums=numbers(claim);const claimPhrases=ngrams(claim,2);if(!claimTokens.size)return{score:0,shared:[],phraseShared:[],numericMismatch:false,kind:'none'};
  let best={score:0,shared:[],phraseShared:[],numericMismatch:false,kind:'none',text:''};
  for(const unit of evidenceUnits(source)){
    const unitTokens=tokenize(unit.text);const shared=[...claimTokens].filter(x=>unitTokens.has(x));const phraseShared=[...claimPhrases].filter(x=>ngrams(unit.text,2).has(x));const coverage=shared.length/claimTokens.size;const phrase=claimPhrases.size?Math.min(1,phraseShared.length/Math.min(3,claimPhrases.size)):0;const unitNums=numbers(unit.text);const numericMismatch=claimNums.size>0&&[...claimNums].some(n=>!unitNums.has(n));
    let score=coverage*58+Math.min(1,phrase)*22+(unit.kind==='title'?12:unit.kind==='description'?8:0);
    if(claimNums.size&&!numericMismatch)score+=10;else if(numericMismatch)score-=18;
    if(shared.length>=3&&coverage>=0.45)score+=8;
    score=Math.max(0,Math.min(100,Math.round(score)));
    if(score>best.score)best={score,shared:shared.slice(0,20),phraseShared:phraseShared.slice(0,8),numericMismatch,kind:unit.kind,text:unit.text.slice(0,500)};
  }
  return best;
}

const brief=fs.existsSync(briefPath)?JSON.parse(fs.readFileSync(briefPath,'utf8')):{brief:{}};
const nativePublished=fs.existsSync(nativeMarkerPath)?JSON.parse(fs.readFileSync(nativeMarkerPath,'utf8')):null;
const verification=fs.existsSync(verificationPath)?JSON.parse(fs.readFileSync(verificationPath,'utf8')):{records:[]};
const records=Array.isArray(verification.records)?verification.records:[];
const files=fs.existsSync(articleDir)?fs.readdirSync(articleDir).filter(f=>f.endsWith('.md')).sort((a,b)=>fs.statSync(`${articleDir}/${b}`).mtimeMs-fs.statSync(`${articleDir}/${a}`).mtimeMs):[];
if(!files.length){console.log('No generated article; claim verification skipped.');process.exit(0);}
const articlePath=`${articleDir}/${files[0]}`;const raw=fs.readFileSync(articlePath,'utf8');
const frontmatterTitle=(raw.match(/^---[\s\S]*?\n(?:title|headline):\s*["']?(.+?)["']?\s*\n[\s\S]*?---/i)?.[1]||'').trim();
const briefTitle=(brief.brief?.title||'').trim();const nativeTitle=(nativePublished?.candidate?.title||'').trim();
const articleTokens=tokenize(frontmatterTitle),briefTokens=tokenize(briefTitle),nativeTokens=tokenize(nativeTitle.replace(/\s+-\s+[^-]+$/,''));
const briefOverlap=[...articleTokens].filter(x=>briefTokens.has(x)).length;const nativeOverlap=[...articleTokens].filter(x=>nativeTokens.has(x)).length;const isNative=Boolean(nativePublished&&nativeOverlap>=2);
if(frontmatterTitle&&briefTitle&&briefOverlap<2&&!isNative){console.log(`No matching generated article for current brief; latest article is '${frontmatterTitle}'. Claim verification skipped safely.`);process.exit(0);}

const body=raw.replace(/^---[\s\S]*?---/,'').replace(/^\s*##\s+Sources[\s\S]*$/i,'').trim();
const claims=splitSentences(body).filter(factualClaim).slice(0,30);
const sourceSection=raw.match(/##\s+Sources\s*\n([\s\S]*?)(?:\n##\s|$)/i)?.[1]||'';
const articleSources=[...sourceSection.matchAll(/-\s+\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g)].map(m=>({title:m[1],url:normalizeUrl(m[2])})).filter(s=>s.url&&!isGoogleNews(s.url));
const briefSources=(brief.brief?.sources||[]).map(s=>({title:s.title||'',url:normalizeUrl(s.url)})).filter(s=>s.url&&!isGoogleNews(s.url));
function researchEvidence(){const out=[];for(const src of briefSources){const direct=records.find(r=>normalizeUrl(r.link)===src.url);if(direct)for(const item of (direct.sources||[])){if(!item.ok)continue;const url=normalizeUrl(item.finalUrl||item.url);if(!url||isGoogleNews(url))continue;out.push({title:item.title||src.title,url,domain:domainOf(url),resolvedFrom:item.resolvedFrom||'verified-research'});}}if(!out.length&&briefTitle)for(const r of records){if(topicScore(briefTitle,r.title||'')<3)continue;for(const item of (r.sources||[])){if(!item.ok)continue;const url=normalizeUrl(item.finalUrl||item.url);if(!url||isGoogleNews(url))continue;out.push({title:item.title||r.title,url,domain:domainOf(url),resolvedFrom:item.resolvedFrom||'verified-research'});}}const seen=new Set();return out.filter(x=>{if(seen.has(x.url))return false;seen.add(x.url);return true;}).slice(0,8);}
const verifiedResearch=researchEvidence();const researchByUrl=new Map(verifiedResearch.map(s=>[normalizeUrl(s.url),s]));
const alignedArticleSources=articleSources.map(s=>researchByUrl.get(normalizeUrl(s.url))||s);
const sourceInputs=(alignedArticleSources.length>=2?alignedArticleSources:verifiedResearch).filter((s,i,a)=>s.url&&a.findIndex(x=>normalizeUrl(x.url)===normalizeUrl(s.url))===i).slice(0,8);
if(!sourceInputs.length){const result={version:7,generatedAt:new Date().toISOString(),articlePath,verificationMode:'article-and-verified-research-sources',sourceCount:0,usableSourceCount:0,claimCount:claims.length,verified:0,partial:0,unsupported:claims.length,sourceUnavailable:0,averageConfidence:0,pass:false,policy:{verifiedMin:60,partialMin:42,blockUnsupported:true,blockUnavailable:true,minimumAverageConfidence:60},reason:'No direct verified publisher evidence was available for the generated candidate.'};fs.writeFileSync(outputPath,JSON.stringify(result,null,2)+'\n');console.log(`Claim Verification v7: ${claims.length} claim(s) — BLOCK (no verified research evidence).`);process.exit(1);}

const sources=[];for(const source of sourceInputs)sources.push(await fetchSource(source));const usable=sources.filter(s=>s.ok&&s.text.length>120);
const verifiedClaims=claims.map((claim,index)=>{const matches=usable.map(s=>({source:s.url,title:s.title||s.description,...evidenceScore(claim,s)})).sort((a,b)=>b.score-a.score);const best=matches[0];const second=matches[1];const corroborated=Boolean(second&&second.score>=48&&best&&best.score>=55);const effective=Math.max(best?.score||0,corroborated?Math.min(85,Math.round(((best?.score||0)+(second?.score||0))/2)+8):0);const status=!best?'source_unavailable':effective>=60?'verified':effective>=42?'partial':'unsupported';return{id:index+1,claim,status,confidence:effective,bestSource:best?.source||null,corroboratingSource:corroborated?second.source:null,sharedTerms:best?.shared||[],phraseMatches:best?.phraseShared||[],evidenceKind:best?.kind||'none',evidenceSnippet:best?.text||''};});
const verified=verifiedClaims.filter(c=>c.status==='verified').length;const partial=verifiedClaims.filter(c=>c.status==='partial').length;const unsupported=verifiedClaims.filter(c=>c.status==='unsupported').length;const unavailable=verifiedClaims.filter(c=>c.status==='source_unavailable').length;const average=verifiedClaims.length?Math.round(verifiedClaims.reduce((n,c)=>n+c.confidence,0)/verifiedClaims.length):0;
const pass=claims.length===0||(usable.length>0&&unsupported===0&&unavailable===0&&average>=60);
const result={version:7,generatedAt:new Date().toISOString(),articlePath,verificationMode:isNative?'native-publication-sources':'article-and-verified-research-sources',sourceCount:sourceInputs.length,usableSourceCount:usable.length,claimCount:claims.length,verified,partial,unsupported,sourceUnavailable:unavailable,averageConfidence:average,pass,policy:{verifiedMin:60,partialMin:42,blockUnsupported:true,blockUnavailable:true,minimumAverageConfidence:60},sources:sources.map(({text,...s})=>s),claims:verifiedClaims};fs.mkdirSync('data',{recursive:true});fs.writeFileSync(outputPath,JSON.stringify(result,null,2)+'\n');console.log(`Claim Verification v7: ${claims.length} claim(s) — ${verified} verified, ${partial} partial, ${unsupported} unsupported, ${unavailable} source-unavailable; average confidence ${average}; ${pass?'PASS':'BLOCK'} (${result.verificationMode}).`);if(!pass)process.exit(1);
