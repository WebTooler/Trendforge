import assert from 'node:assert/strict';
import { mapMaterialSentencesToFacts } from '../scripts/trendforge-editorial-policy.mjs';

const factMap={coreFacts:[
  {factId:'F1',text:'Trump Media announced Truth PSI, a service that gives paying customers milliseconds-early access to certain Truth Social posts.'},
  {factId:'F2',text:'The announcement said the service could include posts affecting financial markets or national security.'},
  {factId:'F3',text:'Trump Media shares rose 0.6% to $9.63 after the announcement.'}
]};

const direct=mapMaterialSentencesToFacts([
  'Trump Media announced Truth PSI, allowing paying customers to see certain Truth Social posts milliseconds before other users.'
],factMap);
assert.equal(direct.unmappedMaterialSentences,0,'A close paraphrase of a core fact must remain mappable.');

const unsupported=mapMaterialSentencesToFacts([
  'The announcement could influence commodity prices and related stocks within minutes.'
],factMap);
assert.equal(unsupported.unmappedMaterialSentences,1,'An unsupported market-impact inference must not map through generic topic overlap.');

const supportedInference=mapMaterialSentencesToFacts([
  'The service could include posts that affect financial markets or national security.'
],factMap);
assert.equal(supportedInference.unmappedMaterialSentences,0,'An evidence-backed inference must remain mappable when the fact itself contains the possibility.');

const numericConflict=mapMaterialSentencesToFacts([
  'Trump Media shares rose 2.4% to $9.63 after the announcement.'
],factMap);
assert.equal(numericConflict.unmappedMaterialSentences,1,'A changed numeric claim must not map to a fact with different numbers.');

console.log('Writer evidence claim mapping regression: PASS');
