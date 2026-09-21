import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const scoredPath='data/scored-trends.json';
const articlesDir='content/articles';
const decisionPath='data/decision-queue.json';
const integrityPath='data/evidence-integrity.json';
const nativeMarker='data/native-writer-published.json';
const currentRunArticlePath='data/current-run-article.json';

fs.mkdirSync('data',{recursive:true});
fs.writeFileSync(currentRunArticlePath,JSON.stringify({version:1,runId:process.env.GITHUB_RUN_ID||'local',generated:false,articlePath:null,briefTitle:null,updatedAt:new Date().toISOString()},null,2)+'\n');
// Native-writer publication is run-scoped too; never inherit a stale marker from an older run.
try{fs.rmSync(nativeMarker,{force:true});}catch{}
if(!fs.existsSync(scoredPath)){console.log(`No ${scoredPath}; nothing to publish.`);process.exit(0);}

const original=JSON.parse(fs.readFileSync(scoredPath,'utf8'));
const trends=original.trends??[];
const preferredFallbackCategories=new Set(['How-To','Technology','Innovation','Product Launches','Digital Life','AI','Crypto']);
const decisionRun=spawnSync('node',['scripts/trend-decision-engine.mjs'],{stdio:'inherit',env:process.env});
if(decisionRun.error)console.log(`Decision Engine unavailable: ${decisionRun.error.message}`);

let decisionQueue=null;
if(fs.existsSync(decisionPath)){try{decisionQueue=JSON.parse(fs.readFileSync(decisionPath,'utf8'));}catch{decisionQueue=null;}}

// Evidence Integrity is the authoritative pre-AI gate. A candidate that merely
// has two URLs/domains from source verification is NOT safe to send to a provider:
// those URLs may still resolve to a homepage, section page, or unrelated article.
// Keep the gate fail-closed and carry its decision by candidate link.
let integrityByLink=new Map();
if(fs.existsSync(integrityPath)){
  try{
    const integrity=JSON.parse(fs.readFileSync(integrityPath,'utf8'));
    integrityByLink=new Map((integrity.report??[]).map(item=>[item.link,item]));
  }catch{integrityByLink=new Map();}
}
const hasIntegrityGate=integrityByLink.size>0;
const integrityPassed=item=>{
  if(!hasIntegrityGate)return Boolean(item.evidenceIntegrityPassed);
  return integrityByLink.get(item.link)?.status==='pass' && item.evidenceIntegrityBlocked!==true;
};

const before=new Set(fs.existsSync(articlesDir)?fs.readdirSync(articlesDir).filter(name=>name.endsWith('.md')):[]);
const trendByLink=new Map(trends.map(item=>[item.link,item]));
const decisionRanked=(decisionQueue?.decisions??[]).map(decision=>({...trendByLink.get(decision.link),...decision})).filter(item=>item.link);
const ranked=(decisionRanked.length?decisionRanked:[...trends].sort((a,b)=>(b.score??0)-(a.score??0))).filter((candidate,index,all)=>all.findIndex(item=>item.link===candidate.link)===index);
const primary=ranked.filter(item=>item.eligible&&item.decision!=='reject'&&integrityPassed(item));
const fallback=ranked.filter(item=>!item.eligible&&preferredFallbackCategories.has(item.category)&&item.decision!=='reject'&&integrityPassed(item));

// Provider calls are expensive and can hit RPM/TPM/RPD limits. Do not spend them
// on candidates whose generation-time publisher evidence has not passed the
// integrity gate. The old URL/domain count is deliberately not sufficient.
const evidenceReady=item=>integrityPassed(item)&&(
  Boolean(item.evidenceReady) ||
  ((item.relevantReachableSourceCount??0)>=2&&(item.independentDomainCount??item.uniqueDomainCount??0)>=2)
);
const readyPrimary=primary.filter(evidenceReady);
const readyFallback=fallback.filter(evidenceReady);
const preWriterPath='data/pre-writer-pipeline.json';
let preWriterByLink=new Map();
let hasPreWriterGate=false;
if(fs.existsSync(preWriterPath)){
  try{
    const preWriter=JSON.parse(fs.readFileSync(preWriterPath,'utf8'));
    preWriterByLink=new Map((preWriter.candidates??[]).map(item=>[item.link,item]));
    hasPreWriterGate=true;
  }catch{preWriterByLink=new Map();hasPreWriterGate=false;}
}
const preWriterReady=item=>!hasPreWriterGate||preWriterByLink.get(item.link)?.readyForWriter===true;
const evidencePriority=item=>{
  const row=preWriterByLink.get(item.link);
  const fact=row?.evidence?.storyFactMap||row?.evidence?.editorialEvidenceBrief?.storyFactMap;
  const cap=fact?.capacity||{};
  const core=Number(cap.coreFactCount||0);
  const direct=Number(cap.directCoreFactCount||0);
  const chars=Number(cap.coreFactChars||0);
  const sources=Number(cap.coreSourceCount||0);
  const level={high:3,medium:2,low:1,none:0}[fact?.capacity?.level]??0;
  return level*100000+core*5000+direct*3000+sources*1000+Math.min(chars,999);
};
const queue=[...readyPrimary,...readyFallback]
  .filter(preWriterReady)
  .sort((a,b)=>evidencePriority(b)-evidencePriority(a) || Number(b.decisionScore||0)-Number(a.decisionScore||0))
  .slice(0,8);

const rawEligibleCount=ranked.filter(item=>item.eligible&&item.decision!=='reject').length;
const integrityPassCount=ranked.filter(integrityPassed).length;
console.log(`Evidence Integrity queue gate: ${integrityPassCount}/${rawEligibleCount} decision candidates passed source-page integrity.`);
console.log(`Adaptive publishing queue: ${queue.length} candidate(s) after pre-writer gate (${readyPrimary.length+readyFallback.length} integrity/evidence-ready before pre-writer filter). Evidence priority uses core facts/direct story facts before decision score.`);
if(hasPreWriterGate && queue.length===0){
  console.log('Pre-Writer Gate: BLOCK — no candidate reached readyForWriter. Generate Article and all AI generation paths are skipped.');
  process.exit(0);
}

let published=false;
let attempted=0;
for(const candidate of queue){
  attempted+=1;
  const attemptTrends=trends.map(item=>({...item,eligible:item.link===candidate.link}));
  fs.writeFileSync(scoredPath,JSON.stringify({...original,trends:attemptTrends},null,2));
  console.log(`Attempt ${attempted}/${queue.length}: ${candidate.category} — ${candidate.title}`);
  if(candidate.decisionScore!==undefined)console.log(`Decision Engine: ${candidate.decision} | score ${candidate.decisionScore}/100 | confidence ${candidate.confidence}/100 | ${candidate.reasons.join('; ')}`);

  const result=spawnSync('npx',['tsx','scripts/generate-article.ts'],{stdio:'inherit',env:process.env});
  const after=new Set(fs.existsSync(articlesDir)?fs.readdirSync(articlesDir).filter(name=>name.endsWith('.md')):[]);
  const newArticle=[...after].find(name=>!before.has(name));
  if(newArticle){
    const briefPath='data/article-brief.json';
    let briefTitle=null;try{briefTitle=JSON.parse(fs.readFileSync(briefPath,'utf8'))?.brief?.title||null;}catch{}
    fs.writeFileSync(currentRunArticlePath,JSON.stringify({version:1,runId:process.env.GITHUB_RUN_ID||'local',generated:true,articlePath:`${articlesDir}/${newArticle}`,briefTitle,updatedAt:new Date().toISOString()},null,2)+'\n');
    console.log(`Adaptive queue published current-run article: ${newArticle}`);published=true;break;
  }
  if(result.error)console.log(`Candidate attempt failed to execute: ${result.error.message}`);
  console.log('Candidate did not produce a publishable article; moving to the next candidate.');
}

fs.writeFileSync(scoredPath,JSON.stringify(original,null,2));

if(!published&&!fs.existsSync(nativeMarker)){
  console.log('Adaptive generation exhausted without publication; checking for post-exhaustion Native Writer fallback.');
  const nativeRun=spawnSync('npx',['tsx','scripts/run-native-writer-fallback.mjs'],{stdio:'inherit',env:process.env});
  if(nativeRun.error)console.log(`Post-exhaustion Native Writer failed to execute: ${nativeRun.error.message}`);
  if(fs.existsSync(nativeMarker)){
    const briefPath='data/article-brief.json';
    let briefTitle=null,articlePath=null;try{const marker=JSON.parse(fs.readFileSync(nativeMarker,'utf8'));articlePath=marker?.articlePath||marker?.path||null;briefTitle=JSON.parse(fs.readFileSync(briefPath,'utf8'))?.brief?.title||null;}catch{}
    if(articlePath&&fs.existsSync(articlePath)){
      fs.writeFileSync(currentRunArticlePath,JSON.stringify({version:1,runId:process.env.GITHUB_RUN_ID||'local',generated:true,articlePath,briefTitle,updatedAt:new Date().toISOString(),producer:'native-writer-fallback'},null,2)+'\n');
      console.log('Post-exhaustion Native Writer published a gated current-run article; skipping evergreen fallback.');published=true;
    }else{console.log('Native Writer marker exists but current-run article path is missing; treating as no publication.');}
  }
  else console.log('Post-exhaustion Native Writer produced no publishable article; continuing safely.');
}

// No post-exhaustion evergreen publishing is permitted in V2.
// Every publishable article must originate from a current candidate's
// authoritative evidence pack and pass the downstream verification gates.
if(!published){
  console.log('Adaptive generation exhausted without a canonical-evidence-backed article; no evergreen or synthetic fallback publication is allowed.');
}

