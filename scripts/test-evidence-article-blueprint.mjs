import assert from 'node:assert/strict';
import { deriveEvidenceArticleBlueprint } from './evidence-article-blueprint.mjs';

const rich=deriveEvidenceArticleBlueprint({
  score:95,band:'rich',readyForRichArticle:true,sourceCount:4,totalPassages:62,totalChars:16427,factualSignals:59
});
console.log('rich=',JSON.stringify(rich));
assert.equal(rich.mode,'rich');
assert.deepEqual(rich.targetWords,{min:700,max:1000,soft:850});
assert.deepEqual(rich.h2Guidance,{preferredMin:3,preferredMax:5,writerDecides:true,noPadding:true});
assert.equal(rich.maxH2,5);
assert.equal(rich.requireCrossCheck,true);
assert.match(rich.instruction,/writer chooses the actual H2 structure/i);
assert.match(rich.instruction,/never add a section/i);

const usable=deriveEvidenceArticleBlueprint({
  score:72,band:'usable',readyForRichArticle:true,sourceCount:3,totalPassages:15,totalChars:2058,factualSignals:31
});
console.log('usable=',JSON.stringify(usable));
assert.equal(usable.mode,'bounded');
assert.deepEqual(usable.targetWords,{min:450,max:750,soft:600});
assert.deepEqual(usable.h2Guidance,{preferredMin:2,preferredMax:4,writerDecides:true,noPadding:true});
assert.equal(usable.maxH2,4);
assert.equal(usable.allowContextSection,false);
assert.match(usable.instruction,/writer chooses the actual H2 structure/i);

const thin=deriveEvidenceArticleBlueprint({
  score:45,band:'thin',readyForRichArticle:false,sourceCount:1,totalPassages:4,totalChars:700,factualSignals:4
});
console.log('thin=',JSON.stringify(thin));
assert.equal(thin.mode,'narrow');
assert.deepEqual(thin.targetWords,{min:300,max:500,soft:400});
assert.deepEqual(thin.h2Guidance,{preferredMin:1,preferredMax:2,writerDecides:true,noPadding:true});
assert.equal(thin.maxH2,2);
assert.match(thin.instruction,/use fewer if the evidence does not justify more/i);

const blocked=deriveEvidenceArticleBlueprint({
  score:25,band:'insufficient',readyForRichArticle:false,sourceCount:0,totalPassages:0,totalChars:0,factualSignals:0
});
console.log('blocked=',JSON.stringify(blocked));
assert.equal(blocked.mode,'blocked');
assert.deepEqual(blocked.targetWords,{min:0,max:0,soft:0});
assert.deepEqual(blocked.h2Guidance,{preferredMin:0,preferredMax:0,writerDecides:false,noPadding:true});
assert.equal(blocked.maxH2,0);

console.log('Evidence-driven article blueprint H2 policy test: PASS');
