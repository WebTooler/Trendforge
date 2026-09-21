import assert from 'node:assert/strict';
import { deriveEvidenceArticleBlueprint } from './evidence-article-blueprint.mjs';

const rich=deriveEvidenceArticleBlueprint({band:'rich',readyForRichArticle:true,sourceCount:4,independentPublisherFamilies:3,totalPassages:12,totalChars:12000,evidenceBrief:{storyFactMap:{capacity:{coreFactCount:12,coreFactChars:5000,maxSupportedWords:900,maxFactualClaims:12}}}});
assert.equal(rich.version,3);
assert.equal(rich.mode,'rich');
assert.ok(rich.maxH2>=3&&rich.maxH2<=5);
assert.equal(rich.evidenceCapacity.level,'high');
assert.ok(rich.sectionPlan.includes('limitations/uncertainty'));
assert.equal(rich.synthesis.heading,'What the Evidence Shows');
assert.ok(rich.synthesis.maxWords>=0);

const bounded=deriveEvidenceArticleBlueprint({band:'usable',readyForRichArticle:true,sourceCount:2,independentPublisherFamilies:2,totalPassages:6,totalChars:5000,evidenceBrief:{storyFactMap:{capacity:{coreFactCount:7,coreFactChars:3000,maxSupportedWords:700,maxFactualClaims:7}}}});
assert.equal(bounded.mode,'bounded');
assert.equal(bounded.maxH2,3);
assert.equal(bounded.evidenceCapacity.level,'medium');
assert.equal(bounded.allowContextSection,false);

const thin=deriveEvidenceArticleBlueprint({band:'thin',sourceCount:1,independentPublisherFamilies:1,totalPassages:4,totalChars:1800,evidenceBrief:{storyFactMap:{capacity:{coreFactCount:5,coreFactChars:1800,maxSupportedWords:420,maxFactualClaims:5}}}});
assert.equal(thin.mode,'narrow');
assert.equal(thin.maxH2,2);
assert.equal(thin.targetWords.max,420);
assert.equal(thin.claimBudget.maxFactualClaims,5);
assert.ok(thin.synthesis&&typeof thin.synthesis.allowed==='boolean');
assert.ok(thin.maxH2<=2);

const blocked=deriveEvidenceArticleBlueprint({band:'insufficient'});
assert.equal(blocked.mode,'blocked');
assert.equal(blocked.maxH2,0);
assert.equal(blocked.evidenceCapacity.level,'none');

console.log('Phase 5 smarter article blueprint tests passed.');
