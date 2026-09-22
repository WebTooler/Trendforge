import assert from 'node:assert/strict';
import { assessAttributionUncertainty } from './attribution-uncertainty-guard.mjs';

const uncertain='The company said the launch could initially target enterprise customers, according to the report.';
const preserved='According to the report, the launch could initially target enterprise customers.';
const escalated='The launch will initially target enterprise customers.';
const plain='The company launched the model in London on Tuesday.';

assert.equal(assessAttributionUncertainty(escalated,uncertain).certaintyEscalation,true);
assert.equal(assessAttributionUncertainty(escalated,uncertain).blocked,true);
assert.equal(assessAttributionUncertainty(preserved,uncertain).blocked,false);
assert.equal(assessAttributionUncertainty(plain,'The company launched the model in London on Tuesday.').blocked,false);
assert.equal(assessAttributionUncertainty('The assistant is designed to handle forms and purchases.','The assistant can handle forms and purchases.').blocked,false);

console.log('Phase 6 attribution + uncertainty guard tests passed.');
