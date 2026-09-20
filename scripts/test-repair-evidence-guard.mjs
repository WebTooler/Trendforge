import fs from 'node:fs';
import assert from 'node:assert/strict';
import { loadCanonicalRepairEvidence } from './repair-evidence-guard.mjs';

const path='data/authoritative-evidence-pack.repair-test.json';
const pack={version:1,status:'authoritative',generatedAt:new Date().toISOString(),candidate:{title:'Repair fixture',link:'https://example.com/story',category:'Technology'},policy:'test',sources:[{id:'S1',url:'https://example.com/source',finalUrl:'https://example.com/source',domain:'example.com',publisherFamily:'example.com',title:'Example source',verified:true,primary:true,credibilityTier:'9',lineage:{id:'example-lineage',type:'original',members:1},passages:['Supported fact passage.'],body:'Supported fact passage.',extraction:null}],coverage:{},blueprint:{mode:'usable'}};
fs.writeFileSync(path,JSON.stringify({version:1,status:'authoritative',candidates:[pack]},null,2));
try{
 const ok=loadCanonicalRepairEvidence({briefTitle:'Repair fixture',failedClaims:[{claim:'x',bestUrl:'https://example.com/source',bestPassage:'Supported fact passage.'}],path});
 assert.equal(ok.claims.length,1);
 assert.throws(()=>loadCanonicalRepairEvidence({briefTitle:'Repair fixture',failedClaims:[{claim:'x',bestUrl:'https://evil.example/source',bestPassage:'Supported fact passage.'}],path}),/non-canonical evidence URL/);
 assert.throws(()=>loadCanonicalRepairEvidence({briefTitle:'Repair fixture',failedClaims:[{claim:'x',bestUrl:'https://example.com/source',bestPassage:'Unverified passage.'}],path}),/outside the canonical passage set/);
 console.log('Phase 3 repair evidence guard tests passed.');
}finally{fs.rmSync(path,{force:true});}
