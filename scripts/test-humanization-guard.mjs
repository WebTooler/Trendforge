import assert from 'node:assert/strict';
import { assessHumanization, validateHumanization } from './humanization-guard.mjs';
assert.equal(assessHumanization('In today’s ever-changing world, technology plays a crucial role. It is important to note that this game-changing shift matters.').blocked,true);
assert.equal(assessHumanization('I tested the feature and verified that it worked as expected.').blocked,true);
assert.equal(assessHumanization('Whether you are a beginner, the first step is to check the documented setting.').blocked,true);
assert.equal(assessHumanization('The company announced the launch on Tuesday. The product will initially support three models. The report says availability is limited.').blocked,false);
assert.equal(validateHumanization({content:'The report says the service launched Tuesday. It lists three supported regions. Officials said access will expand later.'}).passed,true);
assert.equal(assessHumanization('The update changes the interface. The update adds a search filter. The update also changes the settings page.').blocked,true);
console.log('Phase 8 humanization guard tests passed.');
