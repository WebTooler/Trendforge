import fs from 'node:fs';

const briefPath='data/article-brief.json';
const nativeMarkerPath='data/native-writer-published.json';
const verificationPath='data/source-verification.json';
const articleDir='content/articles';
const outputPath='data/claim-verification.json';
const STOP=new Set(['about','after','again','also','been','being','could','from','have','into','more','most','over','said','some','than','that','their','there','these','they','this','what','when','which','with','will','would','your','technology','tech','digital','latest','news','update','updates','guide','how','today','artificial','intelligence','company','companies','industry','development','developments','according','reported']);
const tokenize=(text='')=>new Set(String(text).toLowerCase().split(/[^a-z0-9]+/).filter(w=>w.length>=4&&!STOP.has(w)));
const cleanHtml=(html='')=>String(html).replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&#39;|&apos;/gi,"'").replace(/&quot;/gi,'"').replace(/&#x27;/gi,"'").replace(/&#x2F;/gi,'/').replace(/\s+/g,' ').trim();
const splitSentences=(text='')=>String(text).replace(/\s+/g,' ').split(/(?<=[.!?])\s+(?=[A-Z0-9"“])/).map(s=>s.trim()).filter(s=>s.length>=45&&s.length<=420);
const factualClaim=s=>/\b(is|are|was|were|has|have|had|will|can|cannot|announced|launched|released|reported|said|calls?|plans?|expects?|shows?|found|according|percent|%|million|billion|year|month|today|yesterday|202[0-9])\b/i.test(s)||/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/.test(s);
const normalizeUrl=u=>{try{return new URL(u).toString();}catch{return null;}};
const isGoogleNews=u=>{try{return new URL(u).hostname==='news.google.com';}catch{return false;}};
const domainOf=u=>{try{return new URL(u).hostname.replace(/^www\./,'').toLowerCase();}catch{return '';}};
const topicScore=(a,b)=>{const A=tokenize(a),B=tokenize(b);return [...A].filter(x=>B.has(x)).length;};

async function request(url){return fetch(url,{redirect:'follow',signal:AbortSignal.timeout(10000),headers:{'user-agent':'Mozilla/5.0 (compatible; TrendForge-claim-verifier/2.0)','accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8','accept-language':'en-US,en;q=0.9'}});}
async function fetchSource(source){const started=Date.now();try{const r=await request(source.url);const html=await r.text();const text=cleanHtml(html).slice(0,300000);const finalUrl=normalizeUrl(r.url||source.url)||source.url;if(r.ok&&!isGoogleNews(finalUrl)&&text.length>500)return{...source,ok:true,status:r.status,finalUrl,latencyMs:Date.now()-started,text,via:'direct'};return{...source,ok:false,status:r.status,finalUrl,latencyMs:Date.now()-started,text:'',error:'source unavailable or not a direct publisher article'};}catch(e){return{...source,ok:false,status:0,finalUrl:source.url,latencyMs:Date.now()-started,text:'',error:e?.message||String(e)};}}
const evidenceScore=(claim,sourceText,sourceTitle='')=>{const a=tokenize(claim),b=tokenize(sourceText),t=tokenize(sourceTitle);const shared=[...a].filter(x=>b.has(x));const titleShared=[...a].filter(x=>t.has(x));const coverage=a.size?shared.length/a.size:0;const titleCoverage=a.size?titleShared.length/a.size:0;const density=b.size?shared.length/Math.min(a.size,80):0;return{score:Math.round(Math.min(100,coverage*70+density*20+titleCoverage*10)),shared:shared.slice(0,20)};};

const brief=fs.existsSync(briefPath)?JSON.parse(fs.readFileSync(briefPath,'utf8')):{brief:{}};
const nativePublished=fs.existsSync(nativeMarkerPath)?JSON.parse(fs.readFileSync(nativeMarkerPath,'utf8')):null;
const verification=fs.existsSync(verificationPath)?JSON.parse(fs.readFileSync(verificationPath,'utf8')):{records:[]};
const records=Array.isArray(verification.records)?verification.records:[];
const files=fs.existsSync(articleDir)?fs.readdirSync(articleDir).filter(f=>f.endsWith('.md')).sort((a,b)=>fs.statSync(`${articleDir}/${b}`).mtimeMs-fs.statSync(`${articleDir}/${a}`).mtimeMs):[];
if(!files.length){console.log('No generated article; claim verification skipped.');process.exit(0);}
const articlePath=`${articleDir}/${files[0]}`;
const raw=fs.readFileSync(articlePath,'utf8');
const frontmatterTitle=(raw.match(/^---[\s\S]*?\n(?:title|headline):\s*["']?(.+?)["']?\s*\n[\s\S]*?---/i)?.[1]||'').trim();
const briefTitle=(brief.brief?.title||'').trim();
const nativeTitle=(nativePublished?.candidate?.title||'').trim();
const articleTokens=tokenize(frontmatterTitle),briefTokens=tokenize(briefTitle),nativeTokens=tokenize(nativeTitle.replace(/\s+-\s+[^-]+$/,''));
const briefOverlap=[...articleTokens].filter(x=>briefTokens.has(x)).length;
const nativeOverlap=[...articleTokens].filter(x=>nativeTokens.has(x)).length;
const isNative=Boolean(nativePublished&&nativeOverlap>=2);
if(frontmatterTitle&&briefTitle&&briefOverlap<2&&!isNative){console.log(`No matching generated article for current brief; latest article is '${frontmatterTitle}'. Claim verification skipped safely.`);process.exit(0);}

const body=raw.replace(/^---[\s\S]*?---/,'').replace(/^\s*##\s+Sources[\s\S]*$/i,'').trim();
const claims=splitSentences(body).filter(factualClaim).slice(0,30);
const sourceSection=raw.match(/##\s+Sources\s*\n([\s\S]*?)(?:\n##\s|$)/i)?.[1]||'';
const articleSources=[...sourceSection.matchAll(/-\s+\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g)].map(m=>({title:m[1],url:normalizeUrl(m[2])})).filter(s=>s.url&&!isGoogleNews(s.url));
const briefSources=(brief.brief?.sources||[]).map(s=>({title:s.title||'',url:normalizeUrl(s.url)})).filter(s=>s.url);
function researchEvidence(){const out=[];for(const src of briefSources){const direct=records.find(r=>normalizeUrl(r.link)===src.url);if(direct)for(const item of (direct.sources||[])){if(!item.ok)continue;const url=normalizeUrl(item.finalUrl||item.url);if(!url||isGoogleNews(url))continue;out.push({title:item.title||src.title,url,domain:domainOf(url),resolvedFrom:item.resolvedFrom||'verified-research'});}}if(!out.length&&briefTitle)for(const r of records){if(topicScore(briefTitle,r.title||'')<3)continue;for(const item of (r.sources||[])){if(!item.ok)continue;const url=normalizeUrl(item.finalUrl||item.url);if(!url||isGoogleNews(url))continue;out.push({title:item.title||r.title,url,domain:domainOf(url),resolvedFrom:item.resolvedFrom||'verified-research'});}}const seen=new Set();return out.filter(x=>{if(seen.has(x.url))return false;seen.add(x.url);return true;}).slice(0,8);}
const sourceInputs=isNative?articleSources:researchEvidence();
if(!sourceInputs.length&&!isNative){const result={version:4,generatedAt:new Date().toISOString(),articlePath,verificationMode:'verified-research-sources',sourceCount:0,usableSourceCount:0,claimCount:claims.length,verified:0,partial:0,unsupported:claims.length,sourceUnavailable:0,averageConfidence:0,pass:false,policy:{verifiedMin:65,partialMin:45,blockUnsupported:true,blockUnavailable:true,minimumAverageConfidence:60},reason:'No direct verified publisher evidence was available for the generated candidate.'};fs.writeFileSync(outputPath,JSON.stringify(result,null,2)+'\n');console.log(`Claim Verification v4: ${claims.length} claim(s) — BLOCK (no verified research evidence).`);process.exit(1);}
const sources=[];for(const source of sourceInputs)sources.push(await fetchSource(source));
const usable=sources.filter(s=>s.ok&&s.text.length>120);
const verifiedClaims=claims.map((claim,index)=>{const matches=usable.map(s=>({source:s.url,title:s.title,...evidenceScore(claim,s.text,s.title)})).sort((a,b)=>b.score-a.score);const best=matches[0];const status=!best?'source_unavailable':best.score>=65?'verified':best.score>=45?'partial':'unsupported';return{id:index+1,claim,status,confidence:best?.score||0,bestSource:best?.source||null,sharedTerms:best?.shared||[]};});
const verified=verifiedClaims.filter(c=>c.status==='verified').length;
const partial=verifiedClaims.filter(c=>c.status==='partial').length;
const unsupported=verifiedClaims.filter(c=>c.status==='unsupported').length;
const unavailable=verifiedClaims.filter(c=>c.status==='source_unavailable').length;
const average=verifiedClaims.length?Math.round(verifiedClaims.reduce((n,c)=>n+c.confidence,0)/verifiedClaims.length):0;
const pass=claims.length===0||(usable.length>0&&unsupported===0&&unavailable===0&&average>=60);
const result={version:4,generatedAt:new Date().toISOString(),articlePath,verificationMode:isNative?'native-publication-sources':'verified-research-sources',sourceCount:sourceInputs.length,usableSourceCount:usable.length,claimCount:claims.length,verified,partial,unsupported,sourceUnavailable:unavailable,averageConfidence:average,pass,policy:{verifiedMin:65,partialMin:45,blockUnsupported:true,blockUnavailable:true,minimumAverageConfidence:60},sources:sources.map(({text,...s})=>s),claims:verifiedClaims};fs.mkdirSync('data',{recursive:true});fs.writeFileSync(outputPath,JSON.stringify(result,null,2)+'\n');console.log(`Claim Verification v4: ${claims.length} claim(s) — ${verified} verified, ${partial} partial, ${unsupported} unsupported, ${unavailable} source-unavailable; average confidence ${average}; ${pass?'PASS':'BLOCK'} (${result.verificationMode}).`);if(!pass)process.exit(1);
