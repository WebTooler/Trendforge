import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { extractEvidenceFromHtml } from './evidence-extraction.mjs';
import { scoreEvidenceCoverage } from './evidence-coverage.mjs';
import { deriveEvidenceArticleBlueprint } from './evidence-article-blueprint.mjs';
import { buildAuthoritativeEvidencePack } from './authoritative-evidence-pack.mjs';
import { buildEditorialEvidenceBrief } from './editorial-evidence-brief.mjs';

const OUTPUT='data/pre-writer-pipeline.json';
const MAX_CANDIDATES=24;
const MAX_WRITER_QUEUE=8;
const TIMEOUT=9000;

function runStep(name, command, args){
  console.log('\n=== PRE-WRITER: '+name+' ===');
  const r=spawnSync(command,args,{stdio:'inherit',encoding:'utf8'});
  if(r.status!==0){
    console.error('STEP FAILED:',name,'exit',r.status);
    process.exit(r.status||1);
  }
}

function clean(s=''){return String(s).replace(/\s+/g,' ').trim();}
function domainOf(u=''){try{return new URL(u).hostname.replace(/^www\./,'').toLowerCase();}catch{return '';}}
function familyOf(u=''){
  const h=domainOf(u); const p=h.split('.');
  if(p.length<2)return h;
  const suffix=p.slice(-2).join('.');
  const second=new Set(['co.uk','co.in','co.jp','co.nz','co.au','com.br','com.cn']);
  return second.has(suffix)&&p.length>=3?p.slice(-3).join('.'):suffix;
}
async function fetchPage(url){
  try{
    const r=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(TIMEOUT),headers:{
      'user-agent':'TrendForge-pre-writer-pipeline/1.0',
      'accept':'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8'
    }});
    if(!r.ok)return null;
    return {html:await r.text(),finalUrl:r.url||url};
  }catch{return null;}
}


function normalizeUrl(u=''){
  try{const x=new URL(u);x.hash='';for(const k of [...x.searchParams.keys()])if(/^(utm_|fbclid|gclid|mc_cid|mc_eid)/i.test(k))x.searchParams.delete(k);return x.toString().replace(/\/$/,'');}catch{return String(u||'').trim();}
}
function storyTokens(text=''){
  const stop=new Set(['about','after','again','also','been','being','could','from','have','into','more','most','over','said','some','than','that','their','there','these','they','this','what','when','which','with','will','would','your','technology','latest','news','article','story','report','reports','reported','according']);
  return new Set(clean(text).toLowerCase().replace(/[^a-z0-9]+/g,' ').split(/\s+/).filter(w=>w.length>=5&&!stop.has(w)));
}
function similarity(a='',b=''){
  const A=storyTokens(a),B=storyTokens(b);if(!A.size||!B.size)return{jaccard:0,containment:0,shared:0};
  const shared=[...A].filter(x=>B.has(x)).length;
  return{jaccard:shared/Math.max(1,new Set([...A,...B]).size),containment:shared/Math.max(1,Math.min(A.size,B.size)),shared};
}
function phraseOverlap(a='',b=''){
  const words=x=>clean(x).toLowerCase().replace(/[^a-z0-9]+/g,' ').split(/\s+/).filter(Boolean);
  const grams=arr=>{const s=new Set();for(let i=0;i<=arr.length-4;i++)s.add(arr.slice(i,i+4).join(' '));return s;};
  const A=grams(words(a)),B=grams(words(b));return[...A].filter(x=>B.has(x)).length;
}
function loadPublishedHistory(){
  const dir='content/articles';if(!fs.existsSync(dir))return[];
  return fs.readdirSync(dir).filter(n=>n.endsWith('.md')).map(file=>{
    const raw=fs.readFileSync(dir+'/'+file,'utf8');
    const title=(raw.match(/^title:\s*"([\s\S]*?)"\s*$/m)||[])[1]||'';
    const body=raw.replace(/^---[\s\S]*?---/,'').replace(/^## Sources[\s\S]*$/m,'').slice(0,12000);
    const sourceUrls=[...raw.matchAll(/\]\((https?:\/\/[^)]+)\)/g)].map(m=>normalizeUrl(m[1]));
    return{file,title,body,sourceUrls};
  });
}
function duplicateAgainstHistory(record,sources,history){
  const candidateUrls=new Set(sources.map(s=>normalizeUrl(s.url||'')).filter(Boolean));
  const candidateEvidence=sources.map(s=>s.body||s.passages?.join(' ')||'').join(' ');
  for(const old of history){
    const exact=[...candidateUrls].filter(u=>old.sourceUrls.includes(u));
    if(exact.length)return{duplicate:true,reason:'exact-published-source-reuse',matchedFile:old.file,matchedTitle:old.title,matchedUrls:exact};
    const titleSim=similarity(record.title||'',old.title),bodySim=similarity(candidateEvidence,old.body),phrases=phraseOverlap(candidateEvidence,old.body);
    if((titleSim.shared>=4&&titleSim.jaccard>=0.28&&bodySim.containment>=0.16)||(titleSim.shared>=3&&bodySim.jaccard>=0.12&&phrases>=2)||(bodySim.containment>=0.32&&bodySim.shared>=12))
      return{duplicate:true,reason:'same-underlying-story-provenance-overlap',matchedFile:old.file,matchedTitle:old.title,titleSimilarity:titleSim,bodySimilarity:bodySim,sharedPhrases:phrases};
  }
  return{duplicate:false};
}
function annotateLineage(sources,coverage){
  const groups=coverage?.provenanceGroups||[];
  const lineageByIndex=new Map();
  groups.forEach((group,id)=>{
    for(const index of group.sourceIndexes||[]) lineageByIndex.set(index,{
      id:'lineage-'+(id+1),
      type:(group.sourceIndexes||[]).length>1?'syndicated':'independent',
      members:(group.sourceIndexes||[]).length
    });
  });
  return sources.map((source,index)=>({...source,lineage:lineageByIndex.get(index)||{id:'lineage-unknown-'+(index+1),type:'unknown',members:1}}));
}

function duplicateWithinQueue(a,b){
  const urlsA=new Set((a.evidence?.sources||[]).map(s=>normalizeUrl(s.url||'')).filter(Boolean));
  const urlsB=new Set((b.evidence?.sources||[]).map(s=>normalizeUrl(s.url||'')).filter(Boolean));
  if([...urlsA].some(u=>urlsB.has(u)))return{duplicate:true,reason:'same-source-url'};
  const titleSim=similarity(a.title,b.title),bodyA=(a.evidence?.sources||[]).map(s=>s.body||'').join(' '),bodyB=(b.evidence?.sources||[]).map(s=>s.body||'').join(' '),bodySim=similarity(bodyA,bodyB),phrases=phraseOverlap(bodyA,bodyB);
  return{duplicate:(titleSim.shared>=4&&titleSim.jaccard>=0.28&&bodySim.containment>=0.16)||(bodySim.containment>=0.32&&bodySim.shared>=12&&phrases>=2),reason:'same-underlying-story-candidates'};
}

console.log('TrendForge Pre-Writer Pipeline V1');
console.log('Policy: pre-writer gate only; consumes existing research/scoring/source-verification/evidence-integrity artifacts. No AI generation.');

if(process.env.PRE_WRITER_REFRESH_UPSTREAM==='1'){
  runStep('1. Fresh trend research','node',['scripts/trend-research.mjs']);
  runStep('2. Trend scoring','npx',['tsx','scripts/score-trends.ts']);
  runStep('3. Source verification + publisher discovery','node',['scripts/verify-trend-sources.mjs']);
  runStep('4. Evidence integrity preflight','node',['scripts/evidence-integrity-preflight.mjs']);
} else {
  console.log('Using existing upstream artifacts; no upstream steps rerun.');
}

if(!fs.existsSync('data/source-verification.json')){
  console.error('Missing data/source-verification.json'); process.exit(1);
}
if(!fs.existsSync('data/evidence-integrity.json')){
  console.error('Missing data/evidence-integrity.json'); process.exit(1);
}

const verification=JSON.parse(fs.readFileSync('data/source-verification.json','utf8'));
const integrity=JSON.parse(fs.readFileSync('data/evidence-integrity.json','utf8'));

const integrityByLink=new Map((integrity.report||[]).map(r=>[r.link,r]));
const candidates=(verification.records||[])
  .filter(r=>r.status==='verified')
  .map(r=>{
    const preflight=integrityByLink.get(r.link)||null;
    const sourceCount=Number(r.credibleSourceCount||0);
    const independentDomains=Number(r.independentDomainCount??r.uniqueDomainCount??0);
    const integrityPass=preflight?.status==='pass';
    const strongEvidence=preflight?.evidenceLevel==='strong';
    const score=
      (integrityPass?1000:0)+
      (strongEvidence?500:0)+
      Math.min(250,independentDomains*60)+
      Math.min(180,sourceCount*30)+
      Number(r.confidence||0);
    return {...r,__preWriterPriority:score};
  })
  .sort((a,b)=>(b.__preWriterPriority-a.__preWriterPriority)||(b.confidence||0)-(a.confidence||0))
  .slice(0,MAX_CANDIDATES);

const results=[];
const authoritativePacks=[];
const publishedHistory=loadPublishedHistory();
const queueAccepted=[];
let duplicateHistoryBlocked=0;
let duplicateQueueBlocked=0;

for(const record of candidates){
  const preflight=integrityByLink.get(record.link)||null;
  const sourceRows=(record.sources||[])
    .filter(s=>s.ok&&!s.finalUrlIsHomepage&&!s.finalUrlIsFeed)
    .sort((a,b)=>(Number(b.credibleDomain)-Number(a.credibleDomain))||(b.relevanceOverlap||0)-(a.relevanceOverlap||0));

  const seenFamilies=new Set();
  const sources=[];

  for(const source of sourceRows){
    const url=source.finalUrl||source.url;
    const fam=familyOf(url);
    if(!fam||seenFamilies.has(fam))continue;
    const page=await fetchPage(url);
    if(!page)continue;
    const evidence=extractEvidenceFromHtml(page.html,record.title);
    if(!evidence.body||evidence.selectedPassageCount<3)continue;

    seenFamilies.add(fam);
    sources.push({
      url:page.finalUrl,
      domain:domainOf(page.finalUrl),
      publisherFamily:fam,
      title:evidence.headline||source.title||record.title,
      primary:false,
      verified:true,
      credibilityTier:source.credibilityTier||'unknown',
      passages:evidence.passages,
      body:evidence.body,
      extraction:evidence
    });
    if(sources.length>=4)break;
  }

  const evidenceBrief=buildEditorialEvidenceBrief({candidate:record,sources});
  const filteredSources=evidenceBrief.sources;
  if(evidenceBrief.metrics.relevantPassageCount<3||evidenceBrief.metrics.supportedClaimCount<2||evidenceBrief.metrics.relevantChars<900){
    console.log(`Evidence Brief: ${record.title} blocked — raw passages ${evidenceBrief.metrics.rawPassageCount}, relevant passages ${evidenceBrief.metrics.relevantPassageCount}, supported claims ${evidenceBrief.metrics.supportedClaimCount}, relevant chars ${evidenceBrief.metrics.relevantChars}.`);
  }
  sources.length=0;
  sources.push(...filteredSources);

  const duplicateHistory=duplicateAgainstHistory(record,sources,publishedHistory);
  if(duplicateHistory.duplicate){
    duplicateHistoryBlocked++;
    const blockedCoverage=scoreEvidenceCoverage({sources});
    const lineageSources=annotateLineage(sources,blockedCoverage);
    const blockedBlueprint=deriveEvidenceArticleBlueprint(blockedCoverage);
    authoritativePacks.push(buildAuthoritativeEvidencePack({candidate:record,sources:lineageSources,coverage:blockedCoverage,blueprint:blockedBlueprint,evidenceBrief}));
    results.push({title:record.title,link:record.link,category:record.category,verification:{status:record.status,confidence:record.confidence,credibleSourceCount:record.credibleSourceCount,reachableSourceCount:record.reachableSourceCount,discoveredSourceCount:record.discoveredSourceCount},integrityPreflight:preflight,evidence:{sources:lineageSources,coverage:blockedCoverage,blueprint:deriveEvidenceArticleBlueprint(blockedCoverage),editorialEvidenceBrief:evidenceBrief},readyForWriter:false,writerGateReason:duplicateHistory.reason,duplicateStory:duplicateHistory});
    continue;
  }
  const coverage=scoreEvidenceCoverage({sources,evidenceBrief});
  const lineageSources=annotateLineage(sources,coverage);
  const blueprint=deriveEvidenceArticleBlueprint({...coverage,evidenceBrief});
  authoritativePacks.push(buildAuthoritativeEvidencePack({candidate:record,sources:lineageSources,coverage,blueprint,evidenceBrief}));

  const hasValidatedSource=preflight?.status==='pass';
  const substantiveSourceCount=Number(evidenceBrief.metrics.substantiveSourceCount||0);
  const hasIndependentEvidence=coverage.independentPublisherFamilies>=2 && substantiveSourceCount>=2;
  const targetMinWords=Number(blueprint?.targetWords?.min||300);
  const requiredClaims=Math.max(5,Math.ceil(targetMinWords/60));
  const minimumRelevantChars=Math.max(1200,Math.ceil(targetMinWords*4.5));
  const evidenceBriefReady=evidenceBrief.storyCapacity!=='none' && evidenceBrief.metrics.relevantPassageCount>=3 && evidenceBrief.metrics.supportedClaimCount>=requiredClaims && evidenceBrief.metrics.relevantChars>=minimumRelevantChars && substantiveSourceCount>=1;
  const thinEvidenceReady=coverage.band==='thin' && evidenceBrief.metrics.supportedClaimCount>=requiredClaims && evidenceBrief.metrics.relevantChars>=minimumRelevantChars && substantiveSourceCount>=1;
  const singleSourceEligible=coverage.independentPublisherFamilies===1 && substantiveSourceCount>=1 && coverage.band!=='insufficient' && coverage.totalChars>=minimumRelevantChars && coverage.relevantPassageCount>=3 && coverage.supportedClaimCount>=requiredClaims && (coverage.band!=='thin'||thinEvidenceReady);
  const multiSourceEligible=hasIndependentEvidence && coverage.supportedClaimCount>=requiredClaims && coverage.totalChars>=minimumRelevantChars;
  const readyForWriter=hasValidatedSource && evidenceBriefReady && blueprint.mode!=='blocked' && (multiSourceEligible || singleSourceEligible);

  const resultRow={title:record.title,link:record.link,category:record.category,verification:{status:record.status,confidence:record.confidence,credibleSourceCount:record.credibleSourceCount,reachableSourceCount:record.reachableSourceCount,discoveredSourceCount:record.discoveredSourceCount},integrityPreflight:preflight,evidence:{sources:lineageSources,coverage,blueprint,editorialEvidenceBrief:evidenceBrief},readyForWriter,writerGateReason:readyForWriter?'PASS':(!hasValidatedSource?'integrity-preflight-failed':substantiveSourceCount<1?'no-substantive-source-support':coverage.independentPublisherFamilies>=2&&substantiveSourceCount<2?'insufficient-substantive-cross-source-support':!evidenceBriefReady?'editorial-evidence-brief-insufficient':blueprint.mode==='blocked'?'insufficient-evidence':'evidence-capacity-not-ready')};
  const queueDuplicate=queueAccepted.map(x=>duplicateWithinQueue(resultRow,x)).find(x=>x.duplicate);
  if(queueDuplicate){duplicateQueueBlocked++;resultRow.readyForWriter=false;resultRow.writerGateReason=queueDuplicate.reason;resultRow.duplicateStory=queueDuplicate;}
  else if(resultRow.readyForWriter && queueAccepted.length<MAX_WRITER_QUEUE)queueAccepted.push(resultRow);
  results.push(resultRow);
}

const summary={
  candidatesFromVerification:verification.records?.length||0,
  verifiedCandidates:verification.records?.filter(r=>r.status==='verified').length||0,
  candidatesInspected:candidates.length,
  duplicateHistoryBlocked,
  duplicateQueueBlocked,
  integrityPass:results.filter(r=>r.integrityPreflight?.status==='pass').length,
  strongEvidence:results.filter(r=>r.integrityPreflight?.evidenceLevel==='strong').length,
  rich:results.filter(r=>r.evidence.coverage.band==='rich').length,
  usable:results.filter(r=>r.evidence.coverage.band==='usable').length,
  thin:results.filter(r=>r.evidence.coverage.band==='thin').length,
  insufficient:results.filter(r=>r.evidence.coverage.band==='insufficient').length,
  syndicatedLineages:results.reduce((n,r)=>n+(r.evidence?.coverage?.syndicatedSourceGroups||0),0),
  readyForWriter:results.filter(r=>r.readyForWriter).length,
  writerQueueCapacity:MAX_WRITER_QUEUE,
  candidateSelection:{policy:'bounded-evidence-aware',inspected:MAX_CANDIDATES,writerQueue:MAX_WRITER_QUEUE}
};

fs.mkdirSync('data',{recursive:true});
fs.writeFileSync('data/authoritative-evidence-pack.json',JSON.stringify({version:1,generatedAt:new Date().toISOString(),status:'authoritative',policy:'Single canonical evidence pack generated by the pre-writer gate and consumed by downstream generation/verification stages.',candidates:authoritativePacks},null,2)+'\n');
fs.writeFileSync(OUTPUT,JSON.stringify({
  version:3,
  generatedAt:new Date().toISOString(),
  authoritativeEvidencePackVersion:1,
  authoritativeEvidencePacks:authoritativePacks,
  policy:'Production pre-writer gate: consumes existing upstream artifacts, performs publisher-page identity/extraction/coverage/blueprint checks, and blocks AI generation when no writer-ready candidate exists.',
  stages:[
    'trend-research','trend-scoring','source-verification','publisher-discovery',
    'evidence-integrity-preflight','article-identity-and-source-page-validation',
    'evidence-extraction','relevance-filtering','claim-extraction','editorial-evidence-brief-v3','evidence-lineage','evidence-coverage','evidence-density','evidence-band','article-blueprint','published-story-deduplication','same-run-story-deduplication'
  ],
  candidates:results,
  summary
},null,2)+'\n');

console.log('\n=== PRE-WRITER PIPELINE RESULT ===');
console.log(JSON.stringify(summary,null,2));
for(const r of results){
  console.log(JSON.stringify({
    title:r.title,
    confidence:r.verification.confidence,
    integrity:r.integrityPreflight?.status||'missing',
    evidenceScore:r.evidence.coverage.score,
    band:r.evidence.coverage.band,
    families:r.evidence.coverage.independentPublisherFamilies,
    readyForWriter:r.readyForWriter,
    gate:r.writerGateReason
  }));
}
console.log(`Published-story duplicate gate: ${duplicateHistoryBlocked} candidate(s) blocked; same-run story dedupe: ${duplicateQueueBlocked} candidate(s) blocked.`);
console.log('\nEditorial Evidence Brief V3 summary:');
for(const r of results){const b=r.evidence?.editorialEvidenceBrief;if(!b)continue;console.log(JSON.stringify({title:r.title,rawPassages:b.metrics.rawPassageCount,relevantPassages:b.metrics.relevantPassageCount,supportedClaims:b.metrics.supportedClaimCount,publisherFamilies:b.metrics.publisherFamilyCount,relevantEvidenceDensity:b.metrics.relevantEvidenceDensity,evidenceCapacity:b.storyCapacity,uncertainties:b.uncertainty?.length||0,unknowns:b.unknowns?.length||0}));}
console.log('\nPre-Writer pipeline completed. Generate Article was NOT executed by this gate.');
