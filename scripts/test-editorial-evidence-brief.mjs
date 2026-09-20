import assert from 'node:assert/strict';
import { buildEditorialEvidenceBrief } from './editorial-evidence-brief.mjs';

const candidate={
  title:'Bitcoin ETFs record $6.29 billion in weekly inflows',
  description:'Spot Bitcoin exchange-traded funds recorded $6.29 billion in weekly inflows, according to recent market reporting.'
};
const sources=[{
  url:'https://example.com/bitcoin-etf-story',
  domain:'example.com',
  publisherFamily:'example.com',
  verified:true,
  passages:[
    'Spot Bitcoin ETFs recorded $6.29 billion in weekly inflows, according to data cited in the report.',
    'The report said the inflows came as investors increased exposure to Bitcoin through regulated exchange-traded products.',
    'When you purchase through links in our articles, we may earn a small commission.',
    'The president discussed artificial intelligence policy and data centers at an unrelated event.',
    'The publisher announced a conference discount for readers attending its technology summit.'
  ],
  body:'Spot Bitcoin ETFs recorded $6.29 billion in weekly inflows, according to data cited in the report. The report said the inflows came as investors increased exposure to Bitcoin through regulated exchange-traded products.'
}];

const brief=buildEditorialEvidenceBrief({candidate,sources});
assert.equal(brief.version,3);
assert.equal(brief.metrics.rawPassageCount,5);
assert(brief.metrics.relevantPassageCount>=2);
assert(brief.metrics.relevantPassageCount<brief.metrics.rawPassageCount);
assert(brief.metrics.supportedClaimCount>=2);
assert(brief.metrics.relevantEvidenceDensity<1);
assert(brief.storyCapacity==='none');
assert(brief.coreStoryFacts.every(x=>/bitcoin|etf|inflow|6\.29/i.test(x.text)));
assert(!brief.relevantPassages.some(x=>/president|conference discount|commission/i.test(x.text)));

const contradiction=buildEditorialEvidenceBrief({
  candidate:{title:'Company raises revenue forecast',description:''},
  sources:[{
    url:'https://a.example/news',publisherFamily:'a.example',passages:['The company raised its revenue forecast for the year.'],
  },{
    url:'https://b.example/news',publisherFamily:'b.example',passages:['The company cut its revenue forecast for the year.'],
  }]
});
assert(contradiction.contradictions.length>=1);

console.log('Editorial Evidence Brief V3 fixtures: PASS');
console.log(JSON.stringify({
  rawPassageCount:brief.metrics.rawPassageCount,
  relevantPassageCount:brief.metrics.relevantPassageCount,
  supportedClaimCount:brief.metrics.supportedClaimCount,
  density:brief.metrics.relevantEvidenceDensity,
  capacity:brief.storyCapacity,
  contradictionFixtures:contradiction.contradictions.length
},null,2));
