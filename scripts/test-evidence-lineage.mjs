import assert from 'node:assert/strict';
import { scoreEvidenceCoverage } from './evidence-coverage.mjs';

const source=(url,publisherFamily,title,body)=>({url,publisherFamily,title,body,passages:body.split('. ').filter(Boolean),verified:true});
const reutersOriginal=source('https://www.reuters.com/world/example-story','reuters.com','Example company launches new AI model','The company announced a new AI model on September 20 2026. The model costs $10 million to develop and will be available to customers. Officials said the release follows a year of research.');
const reutersRepublisher=source('https://example.com/reuters-example-story','example.com','Example company launches new AI model','Reuters reported that the company announced a new AI model on September 20 2026. The model costs $10 million to develop and will be available to customers. Officials said the release follows a year of research.');
const sameFamily=source('https://www.reuters.com/business/second-page','reuters.com','Example company expands AI operations','The company expanded its AI operations on September 20 2026. Officials said the expansion includes new research teams and customer services. The investment is worth $20 million.');
const independent=source('https://www.bbc.com/news/example','bbc.com','Regulator publishes separate technology report','A regulator published a separate technology report on September 20 2026. The report examined consumer safety rules and included findings from a three-year survey. Researchers identified several compliance issues.');
const coverage=scoreEvidenceCoverage({sources:[reutersOriginal,reutersRepublisher,sameFamily,independent]});
assert.equal(coverage.provenanceGroups.length,2);
assert.equal(coverage.syndicatedSourceGroups,1);
assert.equal(coverage.provenanceGroups.some(g=>g.sourceIndexes.length===3),true);
assert.equal(coverage.independentPublisherFamilies,2);
console.log('Phase 2 lineage tests passed.');
console.log(JSON.stringify({independentLineages:coverage.independentPublisherFamilies,syndicatedGroups:coverage.syndicatedSourceGroups,groups:coverage.provenanceGroups},null,2));
