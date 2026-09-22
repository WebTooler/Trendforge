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
 'Anthropic announced a new Claude model on September 22, according to the supplied evidence record.',
 'The announcement identifies September 22 as the date on which Anthropic announced the new Claude model.',
 'The company said the model includes stronger safeguards against misuse, according to the evidence.',
 'Anthropic described the stronger safeguards as part of the model announcement and its stated protections against misuse.',
 'Anthropic said the model is available through its developer platform, making that platform part of the documented availability information.',
 'The developer platform is therefore the documented channel through which Anthropic said the model is available.'
].join(' ');

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
