import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildAuthoritativeEvidencePack } from './authoritative-evidence-pack.mjs';

const root=process.cwd();
const verifier=fs.readFileSync(path.join(root,'scripts','verify-article-claims-smart.mjs'),'utf8');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'trendforge-claim-verifier-'));
fs.mkdirSync(path.join(tmp,'scripts'),{recursive:true});
fs.mkdirSync(path.join(tmp,'content','articles'),{recursive:true});
fs.mkdirSync(path.join(tmp,'data'),{recursive:true});

function runArticle(body,evidence){
  fs.writeFileSync(path.join(tmp,'content','articles','fixture.md'),'---\ntitle: "Amazon Bedrock AgentCore migration"\n---\n'+body+'\n');
  const temporal={eventDate:'2026-09-23T00:00:00.000Z',eventDateSource:'metadata',sources:[{sourceId:'S1',sourceDate:'2026-09-18T12:00:00.000Z',temporalStatus:'pre-event'}]};
  const brief={title:'Amazon Bedrock AgentCore migration',summary:'Amazon Bedrock AgentCore migration',storyFactMap:{temporal}};
  const pack=buildAuthoritativeEvidencePack({
    candidate:{title:brief.title,link:'https://example.com/story',category:'Technology'},
    sources:[{id:'S1',title:'AWS',url:'https://aws.amazon.com/example',domain:'aws.amazon.com',publisherFamily:'aws.com',verified:true,primary:true,sourceRole:'PRIMARY',passages:evidence,body:evidence.join(' '),lineage:{id:'lineage-test',type:'independent',members:1}}],
    coverage:{score:90,band:'usable',independentPublisherFamilies:1},
    blueprint:{mode:'bounded',targetWords:{min:300,max:750}}
  });
  fs.writeFileSync(path.join(tmp,'data','article-brief.json'),JSON.stringify({brief,storyFactMap:{temporal},grounding:{sources:[{title:'AWS',url:'https://aws.amazon.com/example',passages:evidence}]}}));
  fs.writeFileSync(path.join(tmp,'data','authoritative-evidence-pack.json'),JSON.stringify({candidates:[pack]}));
  const r=spawnSync(process.execPath,[path.join(root,'scripts','verify-article-claims-smart.mjs')],{cwd:root,encoding:'utf8',env:{...process.env,TREND_FORGE_VERIFY_BRIEF_PATH:path.join(tmp,'data','article-brief.json'),TREND_FORGE_VERIFY_ARTICLE_DIR:path.join(tmp,'content','articles'),TREND_FORGE_VERIFY_OUTPUT:path.join(tmp,'data','claim-verification.json'),TREND_FORGE_VERIFY_EVIDENCE_PACK_PATH:path.join(tmp,'data','authoritative-evidence-pack.json')}});
  let report={};
  try{report=JSON.parse(fs.readFileSync(path.join(tmp,'data','claim-verification.json'),'utf8'));}catch{}
  return {code:r.status,report};
}

const temporalContractChecks=[
  /const temporalEventFromBrief=brief=>/,
  /const temporalSourceDateMap=brief=>/,
  /const temporalStaleEventClaim=\(claim/,
  /stale-post-event/,
  /stale_post_event/
];
for(const re of temporalContractChecks)assert.match(verifier,re);

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
    body:'The migration required no changes to the core agent logic. Teams should review their own infrastructure requirements and IAM permissions carefully before moving.',
    evidence:['The migration required no changes to the core agent logic.'],
    check:r=>r.code===0&&r.report.claims.length===1&&r.report.editorial.length===1
  },
  {
    name:'stale-post-event-prediction',
    body:'Meta is expected to unveil Phoenix at Connect 2026.',
    evidence:['Meta was expected to unveil Phoenix at its September 23 event.'],
    check:r=>r.code!==0&&Array.isArray(r.report.claims)&&r.report.claims.some(x=>x.classification==='stale_post_event'&&x.temporalWarning?.type==='stale-post-event')
  },
  {
    name:'confirmed-post-event-language-is-not-stale',
    body:'Meta announced its new glasses at Connect 2026.',
    evidence:['Meta announced its new glasses at its September 23 event.'],
    check:r=>r.code===0&&Array.isArray(r.report.claims)&&r.report.claims.some(x=>x.status==='verified'&&x.classification!=='stale_post_event')
  },
  {
    name:'future-availability-is-not-stale',
    body:'Meta VR Glasses will ship in Spring 2027.',
    evidence:['Meta announced Meta VR Glasses, with availability planned for Spring 2027.'],
    check:r=>r.code===0&&Array.isArray(r.report.claims)&&r.report.claims.some(x=>x.classification!=='stale_post_event')
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
