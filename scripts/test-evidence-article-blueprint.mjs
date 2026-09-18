import assert from 'node:assert/strict';
import { deriveEvidenceArticleBlueprint } from './evidence-article-blueprint.mjs';

const rich=deriveEvidenceArticleBlueprint({
  score:95,band:'rich',readyForRichArticle:true,sourceCount:4,totalPassages:62,totalChars:16427,factualSignals:59
});
console.log('rich=',JSON.stringify(rich));
assert.equal(rich.mode,'rich');
assert.deepEqual(rich.targetWords,{min:700,max:1000,soft:850});
assert.equal(rich.minH2,3);
assert.equal(rich.maxH2,5);
assert.equal(rich.requireCrossCheck,true);

const usable=deriveEvidenceArticleBlueprint({
  score:72,band:'usable',readyForRichArticle:true,sourceCount:3,totalPassages:15,totalChars:2058,factualSignals:31
});
console.log('usable=',JSON.stringify(usable));
assert.equal(usable.mode,'bounded');
assert.deepEqual(usable.targetWords,{min:450,max:750,soft:600});
assert.equal(usable.minH2,2);
assert.equal(usable.maxH2,4);
assert.equal(usable.allowContextSection,false);

const thin=deriveEvidenceArticleBlueprint({
  score:45,band:'thin',readyForRichArticle:false,sourceCount:1,totalPassages:4,totalChars:700,factualSignals:4
});
console.log('thin=',JSON.stringify(thin));
assert.equal(thin.mode,'narrow');
assert.deepEqual(thin.targetWords,{min:300,max:500,soft:400});
assert.equal(thin.minH2,1);
assert.equal(thin.maxH2,2);

const blocked=deriveEvidenceArticleBlueprint({
  score:25,band:'insufficient',readyForRichArticle:false,sourceCount:0,totalPassages:0,totalChars:0,factualSignals:0
});
console.log('blocked=',JSON.stringify(blocked));
assert.equal(blocked.mode,'blocked');
assert.deepEqual(blocked.targetWords,{min:0,max:0,soft:0});
assert.equal(blocked.maxH2,0);

console.log('Evidence-driven article blueprint test: PASS');
