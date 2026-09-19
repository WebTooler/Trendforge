import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root=process.cwd();
const verifier=fs.readFileSync(path.join(root,'scripts','verify-article-claims-smart.mjs'),'utf8');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'trendforge-claim-verifier-'));
fs.mkdirSync(path.join(tmp,'scripts'),{recursive:true});
fs.mkdirSync(path.join(tmp,'content','articles'),{recursive:true});
fs.mkdirSync(path.join(tmp,'data'),{recursive:true});
fs.writeFileSync(path.join(tmp,'scripts','verify-article-claims-smart.mjs'),verifier);

function runArticle(body,evidence){
  fs.writeFileSync(path.join(tmp,'content','articles','fixture.md'),'---\ntitle: "Amazon Bedrock AgentCore migration"\n---\n'+body+'\n');
  fs.writeFileSync(path.join(tmp,'data','article-brief.json'),JSON.stringify({
    brief:{title:'Amazon Bedrock AgentCore migration',summary:'Amazon Bedrock AgentCore migration'},
    grounding:{sources:[{title:'AWS',url:'https://aws.amazon.com/example',passages:evidence}]}
  }));
  const r=spawnSync(process.execPath,['scripts/verify-article-claims-smart.mjs'],{cwd:tmp,encoding:'utf8'});
  let report={};
  try{report=JSON.parse(fs.readFileSync(path.join(tmp,'data','claim-verification.json'),'utf8'));}catch{}
  return {code:r.status,report};
}

const cases=[
  {
    name:'citation-and-inline-advice',
    body:'The migration reduces infrastructure management while preserving existing agent capabilities. (S1-P6, S1-P18) While the migration process was straightforward, teams should review their own infrastructure requirements and IAM permissions carefully before moving.',
    evidence:['The migration reduces infrastructure management while preserving agent capabilities, including triple-model orchestration and vector-enhanced knowledge retrieval.'],
    check:r=>r.code===0&&r.report.claims.length===1&&r.report.editorial.some(x=>/teams should review/i.test(x.claim))
  },
  {
    name:'ordered-markdown-list',
    body:'The post provides a step-by-step guide using the AgentCore CLI:\n1. Remove existing AgentCore resources.\n2. Tear down the old deployment.\n3. Delete the old endpoint.',
    evidence:['This section provides a step-by-step migration using the AgentCore CLI.','Remove existing AgentCore resources.','Tear down the old deployment.','Delete the old endpoint.'],
    check:r=>r.code===0&&r.report.claims.every(x=>!/: 1\.$/.test(x.claim))&&r.report.claims.some(x=>/step-by-step guide using the AgentCore CLI/i.test(x.claim))
  },
  {
    name:'unsupported-modifier-is-partial',
    body:'The migration steps are straightforward and require no changes to the agent code.',
    evidence:['The migration steps required no changes to the core agent code and existing agent logic remains intact.'],
    check:r=>r.code===0&&r.report.claims.some(x=>x.status==='partial'&&x.scopeWarnings?.includes('straightforward'))
  },
  {
    name:'editorial-recommendation-excluded',
    body:'Teams should review their own infrastructure requirements and IAM permissions carefully before moving.',
    evidence:['The migration required no changes to the core agent logic.'],
    check:r=>r.code===0&&r.report.claims.length===0&&r.report.editorial.length===1
  },
  {
    name:'genuine-unsupported-still-blocks',
    body:'Amazon Bedrock AgentCore launched a rocket from California.',
    evidence:['The migration required no changes to the core agent logic.'],
    check:r=>r.code!==0&&r.report.unsupported>=1
  }
];

let failed=0;
for(const c of cases){
  const r=runArticle(c.body,c.evidence);
  const ok=c.check(r);
  console.log((ok?'PASS ':'FAIL ')+c.name);
  if(!ok){
    failed++;
    console.log(JSON.stringify({code:r.code,claimCount:r.report.claimCount,verified:r.report.verified,partial:r.report.partial,unsupported:r.report.unsupported,claims:r.report.claims,editorial:r.report.editorial},null,2));
  }
}
fs.rmSync(tmp,{recursive:true,force:true});
if(failed)process.exit(1);
console.log('Claim verifier regression suite passed.');
