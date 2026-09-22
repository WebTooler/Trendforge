import fs from 'node:fs';
import assert from 'node:assert/strict';
import { loadCanonicalRepairEvidence } from './repair-evidence-guard.mjs';

const path='data/authoritative-evidence-pack.repair-test.json';
const pack={version:1,status:'authoritative',generatedAt:new Date().toISOString(),candidate:{title:'Repair fixture',link:'https://example.com/story',category:'Technology'},policy:'test',sources:[{id:'S1',url:'https://example.com/source',finalUrl:'https://example.com/source',domain:'example.com',publisherFamily:'example.com',title:'Example source',verified:true,primary:true,sourceRole:'DIRECT_REPORTING',credibilityTier:'9',lineage:{id:'example-lineage',type:'original',members:1},passages:['A publisher paragraph begins here. Supported fact passage. It continues with additional canonical context and attribution.'],body:'Full canonical publisher body.',extraction:null}],coverage:{},blueprint:{mode:'usable'}};
fs.writeFileSync(path,JSON.stringify({version:1,status:'authoritative',candidates:[pack]},null,2));
try{
 const ok=loadCanonicalRepairEvidence({briefTitle:'Repair fixture',failedClaims:[{claim:'x',bestUrl:'https://example.com/source',bestPassage:'Supported fact passage.'}],path});
 assert.equal(ok.claims.length,1);
 const subset=loadCanonicalRepairEvidence({briefTitle:'Repair fixture',failedClaims:[{claim:'x',bestUrl:'https://example.com/source',bestPassageId:'S1-F9',bestPassage:'Supported fact passage. It continues with additional canonical context'}],path});
 assert.equal(subset.claims[0].bestPassage,'A publisher paragraph begins here. Supported fact passage. It continues with additional canonical context and attribution.');
 const byId=loadCanonicalRepairEvidence({briefTitle:'Repair fixture',failedClaims:[{claim:'x',bestUrl:'https://example.com/source',sourceId:'S1',bestPassageId:'S1-P1',bestPassage:'Different whitespace text.'}],path});
 assert.equal(byId.claims[0].bestPassage,'Supported fact passage.');
 const byIdWithoutSource=loadCanonicalRepairEvidence({briefTitle:'Repair fixture',failedClaims:[{claim:'x',bestUrl:'https://example.com/source',bestPassageId:'S1-P1',bestPassage:'Different whitespace text.'}],path});
 assert.equal(byIdWithoutSource.claims[0].bestPassage,'Supported fact passage.');
 const factSentence=loadCanonicalRepairEvidence({briefTitle:'Repair fixture',failedClaims:[{claim:'x',bestUrl:'https://example.com/source',bestPassageId:'S1-F9',bestPassage:'Supported fact passage.'}],path});
 assert.equal(factSentence.claims[0].bestPassage,'Supported fact passage.');
 const byBody=loadCanonicalRepairEvidence({briefTitle:'Repair fixture',failedClaims:[{claim:'x',bestUrl:'https://example.com/source',bestPassageId:'S1-BODY',bestPassage:'Full canonical publisher body.'}],path});
 assert.equal(byBody.claims[0].bestPassage,'Full canonical publisher body.');
 assert.throws(()=>loadCanonicalRepairEvidence({briefTitle:'Repair fixture',failedClaims:[{claim:'x',bestUrl:'https://evil.example/source',bestPassage:'Supported fact passage.'}],path}),/non-canonical evidence URL/);
 assert.throws(()=>loadCanonicalRepairEvidence({briefTitle:'Repair fixture',failedClaims:[{claim:'x',bestUrl:'https://example.com/source',bestPassage:'Unverified passage.'}],path}),/outside the canonical passage set/);
 console.log('Phase 3 repair evidence guard tests passed.');
}finally{fs.rmSync(path,{force:true});}
