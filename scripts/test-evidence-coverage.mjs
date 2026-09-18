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

const ready = scoreEvidenceCoverage({
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
console.log('ready=', JSON.stringify(ready));
assert.equal(ready.band, 'usable');
assert.ok(ready.score >= 55 && ready.score < 75);
assert.equal(ready.readyForRichArticle, true);
assert.deepEqual(ready.blockers, []);
assert.ok(ready.independentPublisherFamilies >= 3);
assert.ok(ready.totalChars >= 1500);

// A genuinely richer fixture should cross the 75-point coverage band.
const rich = scoreEvidenceCoverage({
  sources: [
    makeSource({
      passages: [
        ...makeSource().passages,
        'The company said the rollout began with 120 enterprise customers and will expand after the September 2026 evaluation period.',
        'An internal benchmark recorded a 25 percent reduction in processing time and a 14 percent increase in task completion.'
      ]
    }),
    makeSource({
      url:'https://news.mit.edu/2026/example', publisherFamily:'mit', primary:true,
      passages:[
        'MIT researchers published a study on September 14, 2026 describing a new method for generative AI safety in high-stakes applications.',
        'The method uses hard constraints so outputs must satisfy nonnegotiable physical and task-specific requirements before a result can be accepted.',
        'The researchers reported improved performance while preserving safety constraints in high-stakes settings and described tests across several scenarios.',
        'The team said the method could help generative models operate in robotics, control, and computer vision where unsafe outputs can have real consequences.',
        'The study explains how the constraints are incorporated into the generation process rather than applied only after an answer has been produced.',
        'The researchers evaluated the method across 40 scenarios and reported a 12 percent improvement on the measured task while retaining the required constraints.',
        'The paper states that the approach is designed for systems where a failed safety condition must block the generated action rather than merely trigger a warning.'
      ]
    }),
    makeSource({
      url:'https://arstechnica.com/ai/example', publisherFamily:'ars',
      passages:[
        'Ars Technica reported that the product will use a new model architecture and launch in 2029 after further development.',
        'The company said the system can process 10 million operations per second in the planned configuration and described the hardware tradeoffs involved.',
        'The report described the engineering tradeoffs, deployment constraints, and quoted company representatives about the planned system.',
        'The article said the configuration could be offered in multiple versions depending on performance and infrastructure requirements.',
        'The report also noted that the project remains subject to development decisions before any commercial launch.',
        'Engineers estimated that the planned configuration would require 3.2 kilowatts under the stated workload and described cooling as a deployment constraint.',
        'The report compared two configurations and said the higher-throughput version would trade power efficiency for additional processing capacity.'
      ]
    }),
    makeSource({
      url:'https://www.theverge.com/ai/example', publisherFamily:'theverge',
      passages:[
        'The Verge reported on September 16, 2026 that the product is being tested with developers and that the first rollout is limited.',
        'The company said the preview supports automated tasks while keeping users in the review loop before consequential actions are completed.',
        'Developers can inspect activity logs and stop an automated run before it reaches an external system.',
        'The company described the preview as an early release and said broader availability depends on feedback from participating developers.',
        'The article noted that the workflow is designed around human approval for actions that can change data or account settings.',
        'The company reported that more than 5,000 developers had joined the preview during its first week.'
      ]
    })
  ]
});
console.log('rich=', JSON.stringify(rich));
assert.equal(rich.band, 'rich');
assert.ok(rich.score >= 75);
assert.ok(rich.independentPublisherFamilies >= 4);
assert.ok(rich.totalChars >= 3000);
assert.equal(rich.blockers.includes('single_publisher_family'), false);
assert.equal(rich.blockers.includes('low_evidence_volume'), false);

const thin = scoreEvidenceCoverage({
  sources: [makeSource({
    passages:['The company announced a new AI product.'],
    body:'The company announced a new AI product.'
  })]
});
console.log('thin=', JSON.stringify(thin));
assert.ok(thin.score < ready.score);
assert.equal(thin.readyForRichArticle, false);
assert.ok(thin.blockers.includes('single_publisher_family'));
assert.ok(thin.blockers.includes('low_evidence_volume'));

const source = scoreEvidenceSource(makeSource());
assert.ok(source.score > 0);
assert.ok(source.factualSignals >= 3);
assert.ok(source.numberSignals >= 1);
console.log('P1 evidence coverage deterministic test: PASS');
