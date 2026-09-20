import assert from 'node:assert/strict';
import { buildVisualBrief, buildImagePrompt, storyAnchors, assessVisualRelevance } from './trendforge-visual-planner.mjs';

const bitcoin = buildVisualBrief({ title: 'Bitcoin ETFs Now Own 6.29% of Every Bitcoin', description: 'ETF holdings are changing the market structure.', category: 'Crypto' });
assert.ok(bitcoin.storyAnchors.includes('bitcoin'));
assert.ok(bitcoin.primarySubject.length > 20);
assert.equal(assessVisualRelevance({ title: 'Bitcoin ETFs Now Own 6.29% of Every Bitcoin', description: 'ETF holdings are changing the market structure.', brief: bitcoin }).passed, true);

const policy = buildVisualBrief({ title: 'Government proposes new AI regulation for model safety', description: 'Lawmakers are debating oversight rules.', category: 'World' });
assert.equal(policy.mode, 'conceptual-editorial');
assert.ok(policy.avoid.includes('generic AI brain'));

const product = buildVisualBrief({ title: 'New Pixel phone launches with upgraded camera', description: 'The device adds a new camera system.', category: 'Technology' });
assert.equal(product.mode, 'editorial-product');

const planned = buildImagePrompt({ title: 'Google unveils Gemini security update', description: 'The company says the update addresses a model vulnerability.', category: 'AI', body: 'Security researchers examined the model and the company described the change.' });
assert.ok(planned.prompt.length <= 1900);
assert.ok(planned.prompt.includes('STORY ANCHORS:'));
assert.ok(planned.prompt.toLowerCase().includes('google'));
assert.ok(planned.prompt.toLowerCase().includes('gemini'));
assert.equal(planned.relevance.passed, true);

const anchors = storyAnchors('The new AI model launches today', 'Google launches Gemini model');
assert.ok(anchors.includes('google'));
assert.ok(anchors.includes('gemini'));
assert.ok(anchors.includes('model'));

console.log('Phase 10 visual relevance planner tests passed.');
const unrelated = { primarySubject: 'generic server rack', scene: 'generic technology office', supportingElements: [] };
assert.equal(assessVisualRelevance({ title: 'Bitcoin ETF holdings', description: 'Exchange traded funds now hold more Bitcoin.', brief: unrelated }).passed, false);
