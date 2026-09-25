import { anchorClaimProvenance } from './claim-provenance-anchor.mjs';

const wrong='Unrelated semantic passage selected by the verifier.';
const correctA='This morning opening prices for bitcoin and ethereum both mark gains of over 10% in the last week and month.';
const correctB='Another major factor in the crypto price surge is short liquidations.';

const single=anchorClaimProvenance({
  provenanceFacts:[{factId:'F2',sourceId:'S1',passageIndex:4,text:correctA}],
  best:{bestPassage:wrong,bestPassageId:'S1-P5'}
});
if(single.text!==correctA) throw new Error('Single fact provenance must use immutable fact text.');
if(single.text===wrong) throw new Error('Semantic best passage must not replace immutable fact text.');

const multi=anchorClaimProvenance({
  provenanceFacts:[
    {factId:'F2',sourceId:'S1',passageIndex:4,text:correctA},
    {factId:'F7',sourceId:'S1',passageIndex:6,text:correctB}
  ],
  best:{bestPassage:wrong,bestPassageId:'S1-P5'}
});
if(multi.text!==correctA+' '+correctB) throw new Error('Composite provenance must preserve all fact texts.');
if(multi.text.includes(wrong)) throw new Error('Composite provenance must not use semantic fallback text.');

console.log('Claim provenance anchor regression: PASS');
