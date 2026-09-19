import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { extractEvidenceFromHtml } from './evidence-extraction.mjs';
import { scoreEvidenceCoverage } from './evidence-coverage.mjs';
import { deriveEvidenceArticleBlueprint } from './evidence-article-blueprint.mjs';

const OUTPUT='data/pre-writer-pipeline.json';
const MAX_CANDIDATES=8;
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

const candidates=(verification.records||[])
  .filter(r=>r.status==='verified')
  .sort((a,b)=>(b.confidence||0)-(a.confidence||0))
  .slice(0,MAX_CANDIDATES);

const integrityByLink=new Map((integrity.report||[]).map(r=>[r.link,r]));
const results=[];

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
      title:source.title||record.title,
      primary:false,
      verified:true,
      credibilityTier:source.credibilityTier||'unknown',
      passages:evidence.passages,
      body:evidence.body,
      extraction:evidence
    });
    if(sources.length>=4)break;
  }

  const coverage=scoreEvidenceCoverage({sources});
  const blueprint=deriveEvidenceArticleBlueprint(coverage);

  const hasValidatedSource=preflight?.status==='pass';
  const readyForWriter=hasValidatedSource && coverage.readyForRichArticle===true && blueprint.mode!=='blocked';

  results.push({
    title:record.title,
    link:record.link,
    category:record.category,
    verification:{
      status:record.status,
      confidence:record.confidence,
      credibleSourceCount:record.credibleSourceCount,
      reachableSourceCount:record.reachableSourceCount,
      discoveredSourceCount:record.discoveredSourceCount
    },
    integrityPreflight:preflight,
    evidence:{
      sources,
      coverage,
      blueprint
    },
    readyForWriter,
    writerGateReason:readyForWriter?'PASS':(!hasValidatedSource?'integrity-preflight-failed':blueprint.mode==='blocked'?'insufficient-evidence':'evidence-capacity-not-ready')
  });
}

const summary={
  candidatesFromVerification:verification.records?.length||0,
  verifiedCandidates:verification.records?.filter(r=>r.status==='verified').length||0,
  candidatesInspected:candidates.length,
  integrityPass:results.filter(r=>r.integrityPreflight?.status==='pass').length,
  strongEvidence:results.filter(r=>r.integrityPreflight?.evidenceLevel==='strong').length,
  rich:results.filter(r=>r.evidence.coverage.band==='rich').length,
  usable:results.filter(r=>r.evidence.coverage.band==='usable').length,
  thin:results.filter(r=>r.evidence.coverage.band==='thin').length,
  insufficient:results.filter(r=>r.evidence.coverage.band==='insufficient').length,
  readyForWriter:results.filter(r=>r.readyForWriter).length
};

fs.mkdirSync('data',{recursive:true});
fs.writeFileSync(OUTPUT,JSON.stringify({
  version:1,
  generatedAt:new Date().toISOString(),
  policy:'Production pre-writer gate: consumes existing upstream artifacts, performs publisher-page identity/extraction/coverage/blueprint checks, and blocks AI generation when no writer-ready candidate exists.',
  stages:[
    'trend-research','trend-scoring','source-verification','publisher-discovery',
    'evidence-integrity-preflight','article-identity-and-source-page-validation',
    'evidence-extraction','evidence-coverage','evidence-band','article-blueprint'
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
console.log('\nPre-Writer pipeline completed. Generate Article was NOT executed by this gate.');
