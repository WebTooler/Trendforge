import assert from 'node:assert/strict';
import { buildEditorialEvidenceBrief } from './editorial-evidence-brief.mjs';
import { deriveEvidenceArticleBlueprint } from './evidence-article-blueprint.mjs';
import { scoreEvidenceCoverage } from './evidence-coverage.mjs';
import { buildAuthoritativeEvidencePack, validateAuthoritativeEvidencePack } from './authoritative-evidence-pack.mjs';


const temporal=deriveTemporalContext({
  candidate:{title:'Meta Connect 2026 unveils new glasses',description:'Meta will hold its Connect event on September 23, 2026.'},
  sources:[
    {id:'S1',publishedAt:'2026-09-18T12:00:00Z'},
    {id:'S2',publishedAt:'2026-09-23T20:00:00Z'}
  ]
});
assert.equal(temporal.eventDate,'2026-09-23T00:00:00.000Z');
assert.equal(temporal.sources[0].temporalStatus,'pre-event');
assert.equal(temporal.sources[1].temporalStatus,'post-event');
assert.equal(temporalStatus({eventDate:new Date('2026-09-23T00:00:00Z'),sourceDate:new Date('2026-09-18T00:00:00Z')}),'pre-event');
assert.equal(temporalStatus({eventDate:new Date('2026-09-23T00:00:00Z'),sourceDate:new Date('2026-09-24T00:00:00Z')}),'post-event');

const candidate={
  title:'Acme launches Nova AI model with lower inference costs',
  description:'Acme launched its Nova AI model in London and said inference costs fell by 20 percent.'
};
const sources=[
  {
    id:'S1',url:'https://acme.example/press/nova-ai',domain:'acme.example',publisherFamily:'acme.example',
    primary:true,verified:true,
    title:'Acme launches Nova AI model in London',
    passages:[
      'Acme launched its Nova AI model in London on Tuesday and said inference costs fell by 20 percent.',
      'Acme will initially offer Nova to enterprise customers in the United Kingdom.',
      'The Nova model supports three deployment sizes for the initial enterprise program.',
      'Acme opened its first Nova customer program during the London launch event.',
      'Acme reported a 20 percent reduction in inference costs compared with its previous deployment baseline.',
      'The first rollout phase covers enterprise customers and will precede broader availability.'
    ]
  },
  {
    id:'S2',url:'https://reuters.example/acme-nova',domain:'reuters.example',publisherFamily:'reuters.example',
    primary:false,verified:true,
    title:'Reuters reports Acme Nova AI launch',
    passages:[
      'Reuters reported that Acme launched the Nova AI model in London on Tuesday.',
      'The company said inference costs fell by 20 percent.',
      'Reuters said the initial customer program is focused on enterprise deployments in the United Kingdom.',
      'Reuters identified Nova as Acme\'s newest model announced at the London event.',
      'The London event marked the start of Acme\'s first Nova customer program.',
      'Acme said broader availability will follow the initial enterprise phase.'
    ]
  },
  {
    id:'S3',url:'https://context.example/ai-history',domain:'context.example',publisherFamily:'context.example',
    primary:false,verified:true,
    title:'A brief history of AI infrastructure',
    passages:[
      'Artificial intelligence systems have changed rapidly over the past decade.',
      'Model deployment can involve different infrastructure choices and operating costs.'
    ]
  }
];

const brief=buildEditorialEvidenceBrief({candidate,sources});
assert.ok(brief.storyFactMap,'story fact map must be emitted');
assert.ok(brief.temporal,'temporal context must be emitted');
assert.ok(brief.storyFactMap.coreFacts.length>=4,'core facts must be extracted');
assert.ok(brief.storyFactMap.capacity.directCoreFactCount>=3,'direct story facts must be available');
assert.ok(brief.sources.some(s=>s.sourceRole==='PRIMARY'));
assert.ok(brief.sources.some(s=>s.sourceRole==='DIRECT_REPORTING'||s.sourceRole==='CORROBORATION'));
assert.equal(brief.storyFactMap.policy.contextCannotCompensateForCore,true);
assert.equal(brief.storyFactMap.policy.synthesisMustReuseVerifiedFacts,true);
assert.ok(brief.storyFactMap.capacity.synthesisCapacity);
assert.ok(Array.isArray(brief.storyFactMap.capacity.synthesisCapacity.allowedFactIds));

// Evidence integrity regressions:
// 1) relevantPassageCount is a raw-passage metric and must never exceed rawPassageCount.
// 2) sentence-level evidence depth is tracked separately.
// 3) independently corroborating publishers must retain separate fact-map entries.
assert.ok(brief.metrics.relevantPassageCount<=brief.metrics.rawPassageCount,
  'relevant passage count must not exceed raw passage count');
assert.ok(brief.metrics.relevantEvidenceUnitCount>=brief.metrics.relevantPassageCount,
  'sentence-level evidence units must be at least the represented raw passages');
const corroboratedLaunchFacts=brief.storyFactMap.facts.filter(f=>/launched.*nova|nova.*launched/i.test(f.text));
assert.ok(new Set(corroboratedLaunchFacts.map(f=>f.sourceId)).size>=2,
  'cross-source corroboration must survive fact-map deduplication');
assert.ok(brief.supportedClaims.some(c=>c.passageId==='S1-P1'),
  'claims must carry stable source-passage provenance IDs');

const coverage=scoreEvidenceCoverage({sources:brief.sources,evidenceBrief:brief});
const blueprint=deriveEvidenceArticleBlueprint({...coverage,evidenceBrief:brief});
assert.ok(blueprint.evidenceCapacity.coreFactCount===brief.storyFactMap.capacity.coreFactCount);
assert.ok(blueprint.evidenceCapacity.maxFactualClaims===brief.storyFactMap.capacity.maxFactualClaims);
assert.ok(blueprint.targetWords.max<=brief.storyFactMap.capacity.maxSupportedWords || blueprint.mode==='blocked');

const weak=buildEditorialEvidenceBrief({
  candidate:{title:'Rare event disclosed by agency',description:'An agency disclosed a rare event.'},
  sources:[{
    url:'https://context.example/background',domain:'context.example',publisherFamily:'context.example',
    passages:[
      'Artificial intelligence systems have changed rapidly over the past decade.',
      'Technology companies often invest in research and development.'
    ]
  }]
});
const weakCoverage=scoreEvidenceCoverage({sources:weak.sources,evidenceBrief:weak});
const weakBlueprint=deriveEvidenceArticleBlueprint({...weakCoverage,evidenceBrief:weak});
assert.equal(weakBlueprint.mode,'blocked');

const canonical=buildAuthoritativeEvidencePack({
  candidate:{title:candidate.title,link:'https://acme.example/story',category:'AI'},
  sources:[{url:'https://acme.example/press/nova-ai',domain:'acme.example',publisherFamily:'acme.example',title:'Acme launches Nova AI',sourceRole:'PRIMARY',verified:true,passages:['Acme launched Nova AI in London.'],body:'Acme launched Nova AI in London.'}],
  coverage:{},
  blueprint:{mode:'narrow'},
  evidenceBrief:brief
});
assert.equal(canonical.evidenceBrief.storyFactMap.version,1,'canonical pack must carry fact map');
assert.equal(canonical.sources[0].sourceRole,'PRIMARY','canonical pack must carry source role');
assert.equal(validateAuthoritativeEvidencePack(canonical),true,'canonical pack with fact map must validate');
const brokenCanonical=structuredClone(canonical);
delete brokenCanonical.evidenceBrief.storyFactMap;
assert.equal(validateAuthoritativeEvidencePack(brokenCanonical),false,'missing canonical fact map must fail closed');

console.log('Story Fact Map V1 fixtures: PASS');
console.log(JSON.stringify({
  coreFacts:brief.storyFactMap.capacity.coreFactCount,
  directCoreFacts:brief.storyFactMap.capacity.directCoreFactCount,
  coreChars:brief.storyFactMap.capacity.coreFactChars,
  capacity:brief.storyFactMap.capacity.level,
  blueprintMode:blueprint.mode,
  weakBlueprintMode:weakBlueprint.mode
},null,2));
