import fs from 'node:fs';
import { anchorClaimProvenance } from './claim-provenance-anchor.mjs';

const fixture=JSON.parse(fs.readFileSync(new URL('../tests/fixtures/claim-verifier/run-400-muse-baseline.json',import.meta.url),'utf8'));
const supported=fixture.claims.filter(c=>c.expected==='supported'||c.expected==='supported-synthesis');
if(supported.length<7) throw new Error('Run 400 fixture does not contain enough supported provenance cases.');

for(const c of supported){
  const wrongBest={
    bestPassage:'It’s likely Meta intended for apps working with Muse to control UI settings.',
    bestPassageId:'S1-P7'
  };
  const coreFact={
    factId:`fixture-${c.id}`,
    sourceId:c.sourceId,
    passageIndex:Number(String(c.sourcePassageId).split('-P')[1])-1,
    passageId:c.sourcePassageId,
    text:c.support
  };
  const anchored=anchorClaimProvenance({provenanceFacts:[coreFact],coreFactMatch:coreFact,best:wrongBest});
  if(anchored.text!==c.support) throw new Error(`${c.id}: provenance anchor did not use immutable fact text.`);
  if(anchored.passageId!==c.sourcePassageId) throw new Error(`${c.id}: provenance anchor lost immutable passageId.`);
  if(anchored.text===wrongBest.bestPassage) throw new Error(`${c.id}: verifier regressed to unrelated semantic passage.`);
}

const multi=anchorClaimProvenance({
  provenanceFacts:[
    {sourceId:'S1',passageIndex:0,passageId:'S1-P1',text:'Meta promoted Muse as built from the ground up for privacy and security.'},
    {sourceId:'S1',passageIndex:8,passageId:'S1-P9',text:'The zero-day gives locally run apps and terminal commands complete control of the agent.'}
  ],
  best:{bestPassage:'unrelated passage',bestPassageId:'S1-P6'}
});
if(!multi.text.includes('privacy and security')||!multi.text.includes('complete control')) throw new Error('Multi-fact provenance did not compose immutable fact text.');
if(multi.passageId!=='S1-P1,S1-P9') throw new Error('Multi-fact provenance did not preserve immutable passage IDs.');

console.log(`Run 400 provenance regression PASS: ${supported.length} supported claims anchored to immutable fact text; raw-vs-filtered mismatch protected.`);
