import assert from 'node:assert/strict';
import { validateDraft } from './trendforge-editorial-policy.mjs';

const blueprint={mode:'narrow',targetWords:{min:220},synthesis:{allowed:false,maxStatements:0}};
const factMap={coreFacts:[
 {factId:'F1',text:'Anthropic announced a new Claude model on September 22.'},
 {factId:'F2',text:'The company said the model includes stronger safeguards against misuse.'},
 {factId:'F3',text:'Anthropic said the model is available through its developer platform.'}
]};

const base={title:'Anthropic announces a new Claude model',description:'Anthropic announced a new Claude model with stronger safeguards and availability through its developer platform.',category:'AI',blueprint,maxFactualClaims:3,evidenceFactMap:factMap};

const contentWithinBudget=[
 'Anthropic announced a new Claude model on September 22. The supplied evidence records that calendar date as the announcement date, and this sentence deliberately restates that same dated event without introducing another launch, product, capability, or company action.',
 'September 22 remains the recorded announcement date in the supplied evidence. This second sentence repeats the same dated announcement fact in different wording, so it must resolve to F1 rather than consume an additional factual claim slot.',
 'The company said the model includes stronger safeguards against misuse. The evidence presents those safeguards as part of the documented protection claim, and this sentence does not introduce another security feature, benchmark, or technical capability beyond that supplied statement.',
 'The documented safeguard statement concerns protection against misuse. It is a restatement of the same safeguard fact from the evidence record, using different wording while deliberately avoiding a new product capability or separate security event.',
 'Anthropic said the model is available through its developer platform. The supplied evidence identifies that developer platform as the documented access channel, and this sentence adds no separate distribution agreement, pricing statement, regional restriction, or additional service claim.',
 'The recorded access channel is Anthropic’s developer platform. This repeats the same availability fact in different wording and is intentionally limited to the documented platform relationship, so it should map to F3 rather than create a fourth factual claim.'


const pass=validateDraft({...base,content:contentWithinBudget});
assert.equal(pass.passed,true,'Repeated sentences supported by the same facts must not consume the claim budget: '+pass.errors.join('; '));
assert.equal(pass.metrics.evidenceClaimMetrics.materialSentenceCount,6);
assert.equal(pass.metrics.evidenceClaimMetrics.distinctFactClaimCount,3);
assert.equal(pass.metrics.evidenceClaimMetrics.unmappedMaterialSentences,0);

const overBudget=contentWithinBudget+' The evidence also says the model was trained in a new facility in London.';
const blocked=validateDraft({...base,content:overBudget});
assert.equal(blocked.passed,false,'A genuinely new unsupported proposition must not fit inside the existing fact budget.');
assert.match(blocked.errors.join('; '),/material factual claim count 4 exceeds evidence claim budget 3/);

console.log('Writer evidence claim mapping test: PASS');
