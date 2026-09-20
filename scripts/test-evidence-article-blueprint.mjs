import assert from 'node:assert/strict';
import { deriveEvidenceArticleBlueprint } from './evidence-article-blueprint.mjs';

const rich=deriveEvidenceArticleBlueprint({band:'rich',readyForRichArticle:true,sourceCount:4,independentPublisherFamilies:3,totalPassages:12,totalChars:12000});
assert.equal(rich.version,2);
assert.equal(rich.mode,'rich');
assert.ok(rich.maxH2>=3&&rich.maxH2<=5);
assert.equal(rich.evidenceCapacity.level,'high');
assert.ok(rich.sectionPlan.includes('limitations/uncertainty'));

const bounded=deriveEvidenceArticleBlueprint({band:'usable',readyForRichArticle:true,sourceCount:2,independentPublisherFamilies:2,totalPassages:6,totalChars:5000});
assert.equal(bounded.mode,'bounded');
assert.equal(bounded.maxH2,3);
assert.equal(bounded.evidenceCapacity.level,'medium');
assert.equal(bounded.allowContextSection,false);

const thin=deriveEvidenceArticleBlueprint({band:'thin',sourceCount:1,independentPublisherFamilies:1,totalPassages:2,totalChars:800});
assert.equal(thin.mode,'narrow');
assert.equal(thin.maxH2,2);
assert.equal(thin.targetWords.max,500);

const blocked=deriveEvidenceArticleBlueprint({band:'insufficient'});
assert.equal(blocked.mode,'blocked');
assert.equal(blocked.maxH2,0);
assert.equal(blocked.evidenceCapacity.level,'none');

console.log('Phase 5 smarter article blueprint tests passed.');
