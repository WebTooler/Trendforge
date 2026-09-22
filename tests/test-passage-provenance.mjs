import assert from 'node:assert/strict';
import { buildStoryFactMap } from '../scripts/story-fact-map.mjs';
import { anchorClaimProvenance } from '../scripts/claim-provenance-anchor.mjs';

const candidate={title:'Bitcoin and ethereum prices today',description:'Bitcoin and ethereum prices moved higher.'};
const sources=[
  {id:'S1',title:'Bitcoin and ethereum prices today',sourceRole:'DIRECT_REPORTING',passages:['Opening paragraph.','Bitcoin opened at $86,597.82 and Ethereum opened at $2,775.96.']},
  {id:'S2',title:'Independent crypto market report',sourceRole:'CORROBORATION',passages:['Bitcoin opened at $86,597.82, according to the report.']}
];
const evidenceBrief={supportedClaims:[
  {id:'C1',sourceId:'S1',passageIndex:2,passageId:'S1-P9',text:'Bitcoin opened at $86,597.82 and Ethereum opened at $2,775.96.',relevanceScore:10,numbers:['86597.82','2775.96'],attribution:false},
  {id:'C2',sourceId:'S2',passageIndex:1,passageId:'S2-P4',text:'Bitcoin opened at $86,597.82, according to the report.',relevanceScore:9,numbers:['86597.82'],attribution:true}
]};
const map=buildStoryFactMap({candidate,sources,evidenceBrief});
const f=map.facts.find(x=>x.claimId==='C1');
assert.equal(f.passageId,'S1-P9');
assert.equal(map.facts.find(x=>x.claimId==='C2').passageId,'S2-P4');
const anchored=anchorClaimProvenance({provenanceFacts:[f]});
assert.equal(anchored.passageId,'S1-P9');
assert.equal(anchored.text,f.text);
console.log('PASS: immutable passageId survives evidence brief -> fact map -> provenance anchor');
