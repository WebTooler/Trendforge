import assert from 'node:assert/strict';
import { scoreEvidenceCoverage, scoreEvidenceSource } from './evidence-coverage.mjs';

const makeSource = (overrides={}) => ({
  url: 'https://techcrunch.com/example',
  publisherFamily: 'techcrunch',
  verified: true,
  primary: false,
  passages: [
    'The company announced a new AI agent product in September 2026 after a research study found measurable improvements across several tasks.',
    'The CEO said the system was released to customers on September 17, 2026, with support for multiple tasks and a new monitoring workflow.',
    'According to the company, the model reduced processing time by 25 percent in an internal test and changed how teams review automated work.',
    'Researchers described the approach as a way to keep human oversight in the loop while allowing agents to handle longer and more complex tasks.',
    'The report said the product is being evaluated by enterprise customers and that deployment depends on the results of those evaluations.'
  ],
  ...overrides
});

const rich = scoreEvidenceCoverage({
  sources: [
    makeSource(),
    makeSource({
      url:'https://news.mit.edu/2026/example', publisherFamily:'mit', primary:true,
      passages:[
        'MIT researchers published a study on September 14, 2026 describing a new method for generative AI safety in high-stakes applications.',
        'The method uses hard constraints so outputs must satisfy nonnegotiable physical and task-specific requirements before a result can be accepted.',
        'The researchers reported improved performance while preserving safety constraints in high-stakes settings and described tests across several scenarios.',
        'The team said the method could help generative models operate in robotics, control, and computer vision where unsafe outputs can have real consequences.',
        'The study explains how the constraints are incorporated into the generation process rather than applied only after an answer has been produced.'
      ]
    }),
    makeSource({
      url:'https://arstechnica.com/ai/example', publisherFamily:'ars',
      passages:[
        'Ars Technica reported that the product will use a new model architecture and launch in 2029 after further development.',
        'The company said the system can process 10 million operations per second in the planned configuration and described the hardware tradeoffs involved.',
        'The report described the engineering tradeoffs, deployment constraints, and quoted company representatives about the planned system.',
        'The article said the configuration could be offered in multiple versions depending on performance and infrastructure requirements.',
        'The report also noted that the project remains subject to development decisions before any commercial launch.'
      ]
    })
  ]
});
console.log('rich=', JSON.stringify(rich));
assert.equal(rich.band, 'rich');
assert.ok(rich.score >= 75);
assert.ok(rich.independentPublisherFamilies >= 3);
assert.ok(rich.totalChars >= 1500);
assert.equal(rich.blockers.includes('single_publisher_family'), false);

const usable = scoreEvidenceCoverage({
  sources: [makeSource({
    passages:[
      'The company announced a new AI product in September 2026 after a research study found measurable improvements.',
      'The CEO said the system was released to customers on September 17, 2026, with support for multiple tasks.',
      'According to the company, the model reduced processing time by 25 percent in an internal test.'
    ]
  })]
});
console.log('usable=', JSON.stringify(usable));
assert.equal(usable.band, 'usable');
assert.ok(usable.score >= 55 && usable.score < 75);
assert.equal(usable.readyForRichArticle, false);
assert.ok(usable.blockers.includes('single_publisher_family'));

const thin = scoreEvidenceCoverage({
  sources: [makeSource({
    passages:['The company announced a new AI product.'],
    body:'The company announced a new AI product.'
  })]
});
console.log('thin=', JSON.stringify(thin));
assert.ok(thin.score < usable.score);
assert.equal(thin.readyForRichArticle, false);
assert.ok(thin.blockers.includes('single_publisher_family'));
assert.ok(thin.blockers.includes('low_evidence_volume'));

const source = scoreEvidenceSource(makeSource());
assert.ok(source.score > 0);
assert.ok(source.factualSignals >= 3);
assert.ok(source.numberSignals >= 1);
console.log('P1 evidence coverage deterministic test: PASS');
