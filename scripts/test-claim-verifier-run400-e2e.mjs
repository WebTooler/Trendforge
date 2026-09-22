import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const fixture=JSON.parse(fs.readFileSync(new URL('../tests/fixtures/claim-verifier/run-400-muse-baseline.json',import.meta.url),'utf8'));
const supported=fixture.claims.filter(c=>c.expected==='supported'||c.expected==='supported-synthesis');
if(supported.length<7) throw new Error('Run 400 fixture is unexpectedly incomplete.');

const temp=fs.mkdtempSync(path.join(os.tmpdir(),'trendforge-run400-e2e-'));
fs.mkdirSync(path.join(temp,'data'),{recursive:true});
fs.mkdirSync(path.join(temp,'content','articles'),{recursive:true});

const title=fixture.articleTitle;
const passages=Array.from({length:14},(_,i)=>`Unrelated evidence passage ${i+1} about Muse and its application behavior.`);
for(const c of supported){
  const p=Number(String(c.sourcePassageId).split('-P')[1]);
  passages[p-1]=c.support;
}

const coreFacts=supported.map(c=>({
  factId:`RUN400-${c.id}`,
  claimId:c.id,
  sourceId:c.sourceId,
  sourceRole:'DIRECT_REPORTING',
  passageIndex:Number(String(c.sourcePassageId).split('-P')[1])-1,
  passageId:c.sourcePassageId,
  text:c.support,
  core:true,
  attribution:false,
  numbers:[]
}));

const synthesisFacts=coreFacts.filter(f=>f.factId==='RUN400-C2'||f.factId==='RUN400-C15').map(f=>f.factId);
const brief={
  brief:{
    title,
    summary:'Run 400 immutable provenance regression fixture.',
    storyFactMap:{
      version:1,
      sourceRoles:[{id:'S1',role:'DIRECT_REPORTING'}],
      coreFacts,
      capacity:{maxFactualClaims:18,synthesisCapacity:{allowed:true,maxStatements:3,allowedFactIds:synthesisFacts}}
    }
  }
};

const pack={
  version:1,status:'authoritative',evidenceBriefVersion:0,generatedAt:new Date().toISOString(),
  candidate:{title,link:'https://arstechnica.com/security/2026/09/muse-metas-extraordinarily-privileged-ai-assistant-has-a-serious-0-day/',category:'Digital Life'},
  policy:'Run 400 isolated immutable provenance regression pack.',
  sources:[{
    id:'S1',url:'https://arstechnica.com/security/2026/09/muse-metas-extraordinarily-privileged-ai-assistant-has-a-serious-0-day/',
    finalUrl:'https://arstechnica.com/security/2026/09/muse-metas-extraordinarily-privileged-ai-assistant-has-a-serious-0-day/',
    domain:'arstechnica.com',publisherFamily:'Ars Technica',title,verified:true,primary:true,
    sourceRole:'DIRECT_REPORTING',credibilityTier:'high',lineage:{id:'run400-lineage',type:'direct',members:1},passages,body:''
  }],
  coverage:{},blueprint:{}
};

const factual=supported.filter(c=>c.expected==='supported').map(c=>c.claim);
const synthesis=fixture.claims.find(c=>c.expected==='supported-synthesis')?.claim;
const articleContent=[
  '---',`title: "${title.replaceAll('"','\\\"')}"`,'---','',
  '## What Happened',...factual,'','## What the Evidence Shows',synthesis
].join('\\n');

fs.writeFileSync(path.join(temp,'data','article-brief.json'),JSON.stringify(brief,null,2));
fs.writeFileSync(path.join(temp,'data','authoritative-evidence-pack.json'),JSON.stringify(pack,null,2));
fs.writeFileSync(path.join(temp,'content','articles','run-400-regression.md'),articleContent);

const verifierPath=new URL('./verify-article-claims-smart.mjs',import.meta.url);
const run=spawnSync(process.execPath,[verifierPath.pathname],{cwd:temp,env:{...process.env,GITHUB_RUN_ID:'run400-e2e-fixture'},encoding:'utf8'});
if(run.status!==0) throw new Error(`Run 400 E2E verifier failed.\\nSTDOUT:\\n${run.stdout}\\nSTDERR:\\n${run.stderr}`);

const result=JSON.parse(fs.readFileSync(path.join(temp,'data','claim-verification.json'),'utf8'));
if(result.pass!==true) throw new Error('Run 400 E2E verifier did not PASS.');
if(result.unsupported!==0||result.sourceUnavailable!==0) throw new Error(`Run 400 E2E verifier has unsupported/source-unavailable claims: ${result.unsupported}/${result.sourceUnavailable}`);

for(const c of supported){
  const row=result.claims.find(x=>x.claim===c.claim);
  if(!row) throw new Error(`${c.id}: claim missing from verifier output.`);
  if(row.status!=='verified') throw new Error(`${c.id}: expected verified, got ${row.status} (${row.classification}).`);
  if(!String(row.bestPassageId||'').includes(c.sourcePassageId)) throw new Error(`${c.id}: immutable passage provenance was lost. Expected ${c.sourcePassageId}, got ${row.bestPassageId}`);
}
const synthesisRow=result.claims.find(x=>x.claim===synthesis);
if(!synthesisRow||synthesisRow.matchingMode!=='fact-map-multi-fact-source-passage-synthesis') throw new Error('Run 400 synthesis did not use fact-map multi-fact provenance.');

console.log(`Run 400 END-TO-END provenance regression PASS: ${result.verified} verified, ${result.partial} partial, ${result.unsupported} unsupported; immutable source passage IDs preserved.`);
