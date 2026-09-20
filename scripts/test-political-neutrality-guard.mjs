import assert from 'node:assert/strict';
import { assessPoliticalNeutrality, validatePoliticalNeutrality } from './political-neutrality-guard.mjs';

assert.equal(assessPoliticalNeutrality('The candidate said the bill would tighten AI regulation.').blocked,false);
assert.equal(assessPoliticalNeutrality('According to the campaign, the party supports the bill.').blocked,false);
assert.equal(assessPoliticalNeutrality('You should vote for this candidate.').blocked,true);
assert.equal(assessPoliticalNeutrality('Voters should reject this ballot measure.').blocked,true);
assert.equal(assessPoliticalNeutrality('This candidate will win the election.').blocked,true);
assert.equal(assessPoliticalNeutrality('Candidate A is the best choice.').blocked,true);
assert.equal(assessPoliticalNeutrality('Parliament passed the bill after a vote.').blocked,false);
assert.equal(validatePoliticalNeutrality({content:'The government announced a new regulation, according to officials.'}).passed,true);
console.log('Phase 7 political neutrality tests passed.');
