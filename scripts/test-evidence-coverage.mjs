import assert from 'node:assert/strict';
import { scoreEvidenceCoverage, scoreEvidenceSource } from './evidence-coverage.mjs';

const makeSource = (overrides={}) => ({
  url: 'https://techcrunch.com/example',
  publisherFamily: 'techcrunch',
  verified: true,
  primary: false,
  passages: [
    'The company announced a new AI agent product in September 2026 after a research study found measurable improvements.',
    'The CEO said the system was released to customers on September 17, 2026, with support for multiple tasks.',
    'According to the company, the model reduced processing time by 25 percent in an internal test.'
  ],
  ...overrides
});

const rich = scoreEvidenceCoverage({
  sources: [
    makeSource(),
    makeSource({ url:'https://news.mit.edu/2026/example', publisherFamily:'mit', primary:true, passages:[
      'MIT researchers published a study on September 14, 2026 describing a new method for generative AI safety.',
      'The method uses hard constraints so outputs must satisfy nonnegotiable physical and task-specific requirements.',
      'The researchers reported improved performance while preserving safety constraints in high-stakes settings.'
    ]}),
    makeSource({ url:'https://arstechnica.com/ai/example', publisherFamily:'ars', passages:[
      'Ars Technica reported that the product will use a new model architecture and launch in 2029.',
      'The company said the system can process 10 million operations per second in the planned configuration.',
      'The report described the engineering tradeoffs and quoted company representatives about deployment.'
    ]})
  ]
});
console.log('rich=', JSON.stringify(rich));
assert.equal(rich.band, 'rich');
assert.ok(rich.score >= 75);
assert.ok(rich.independentPublisherFamilies >= 3);
assert.equal(rich.blockers.includes('single_publisher_family'), false);

const thin = scoreEvidenceCoverage({
  sources: [makeSource({
    passages:['The company announced a new AI product.'],
    body:'The company announced a new AI product.'
  })]
});
console.log('thin=', JSON.stringify(thin));
assert.ok(thin.score < rich.score);
assert.equal(thin.readyForRichArticle, false);
assert.ok(thin.blockers.includes('single_publisher_family'));

const source = scoreEvidenceSource(makeSource());
assert.ok(source.score > 0);
assert.ok(source.factualSignals >= 3);
assert.ok(source.numberSignals >= 1);
console.log('P1 evidence coverage deterministic test: PASS');
