import assert from 'node:assert/strict';
import { buildAuthoritativeEvidencePack, validateAuthoritativeEvidencePack } from './authoritative-evidence-pack.mjs';

const candidate={title:'Example technology development',link:'https://example.com/story',category:'Technology'};
const sources=[
  {url:'https://reuters.com/story',domain:'reuters.com',publisherFamily:'reuters.com',title:'Reuters report',verified:true,primary:false,passages:['Reuters evidence passage one.','Reuters evidence passage two.'],body:'Reuters body.',lineage:{id:'lineage-1',type:'independent',members:1}},
  {url:'https://bbc.com/story',domain:'bbc.com',publisherFamily:'bbc.com',title:'BBC report',verified:true,primary:false,passages:['BBC evidence passage one.'],body:'BBC body.',lineage:{id:'lineage-2',type:'independent',members:1}}
];
const coverage={score:82,band:'rich',independentPublisherFamilies:2,provenanceGroups:[{sourceIndexes:[0]},{sourceIndexes:[1]}]};
const blueprint={mode:'rich',targetWords:{min:700,max:1000}};

const pack=buildAuthoritativeEvidencePack({candidate,sources,coverage,blueprint,generatedAt:'2026-09-20T00:00:00.000Z'});
assert.equal(validateAuthoritativeEvidencePack(pack),true);
assert.deepEqual(pack.sources.map(s=>s.id),['S1','S2']);
assert.deepEqual(pack.sources.map(s=>s.publisherFamily),['reuters.com','bbc.com']);
assert.deepEqual(pack.sources.map(s=>s.lineage.id),['lineage-1','lineage-2']);

const serialized=JSON.parse(JSON.stringify({version:1,status:'authoritative',candidates:[pack]}));
const selected=serialized.candidates.find(item=>item.candidate.link===candidate.link);
assert.ok(selected);
assert.equal(validateAuthoritativeEvidencePack(selected),true);

// Mirror the writer's canonical-source mapping: only pack.sources may become evidencePack.
// No upstream verification sources or fresh network fetches are introduced here.
const evidencePack=selected.sources.map(source=>({
  title:source.title,url:source.url,passages:source.passages,articleBody:source.body,
  publisherFamily:source.publisherFamily,verified:source.verified,primary:source.primary,lineage:source.lineage
}));
assert.equal(evidencePack.length,2);
assert.deepEqual(evidencePack.map(s=>s.url),sources.map(s=>s.url));
assert.deepEqual(evidencePack.map(s=>s.lineage.id),['lineage-1','lineage-2']);

// Fail-closed checks: wrong candidate and malformed canonical source must not validate.
assert.equal(serialized.candidates.find(item=>item.candidate.link==='https://example.com/missing'),undefined);
const malformed=JSON.parse(JSON.stringify(pack));
malformed.sources[1].passages=[];
assert.equal(validateAuthoritativeEvidencePack(malformed),false);

console.log('Phase 2 authoritative evidence-pack integration tests passed.');
console.log('canonicalSources:',evidencePack.length);
console.log('lineages:',evidencePack.map(s=>s.lineage.id).join(', '));
