import assert from 'node:assert/strict';
import { buildEditorialEvidenceBrief } from './editorial-evidence-brief.mjs';
import { deriveEvidenceArticleBlueprint } from './evidence-article-blueprint.mjs';
import { scoreEvidenceCoverage } from './evidence-coverage.mjs';

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
      'The company said the launch will initially target enterprise customers.',
      'Acme said the model is available to enterprise customers through its initial launch program.',
      'The company reported that the model was introduced in London on Tuesday.',
      'Acme said inference costs fell by 20 percent during its initial deployment.',
      'The company described the enterprise launch as the first phase of the rollout.'
    ]
  },
  {
    id:'S2',url:'https://reuters.example/acme-nova',domain:'reuters.example',publisherFamily:'reuters.example',
    primary:false,verified:true,
    title:'Reuters reports Acme Nova AI launch',
    passages:[
      'Reuters reported that Acme launched the Nova AI model in London on Tuesday.',
      'The company said inference costs fell by 20 percent.',
      'Reuters said the launch initially targets enterprise customers.',
      'The report identified the Nova model as the company\'s latest launch.',
      'The report said the London event marked the initial rollout.',
      'The company described the first phase as focused on enterprise customers.'
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
assert.ok(brief.storyFactMap.coreFacts.length>=4,'core facts must be extracted');
assert.ok(brief.storyFactMap.capacity.directCoreFactCount>=3,'direct story facts must be available');
assert.ok(brief.sources.some(s=>s.sourceRole==='PRIMARY'));
assert.ok(brief.sources.some(s=>s.sourceRole==='DIRECT_REPORTING'||s.sourceRole==='CORROBORATION'));
assert.equal(brief.storyFactMap.policy.contextCannotCompensateForCore,true);

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

console.log('Story Fact Map V1 fixtures: PASS');
console.log(JSON.stringify({
  coreFacts:brief.storyFactMap.capacity.coreFactCount,
  directCoreFacts:brief.storyFactMap.capacity.directCoreFactCount,
  coreChars:brief.storyFactMap.capacity.coreFactChars,
  capacity:brief.storyFactMap.capacity.level,
  blueprintMode:blueprint.mode,
  weakBlueprintMode:weakBlueprint.mode
},null,2));
