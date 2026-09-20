import assert from 'node:assert/strict';
import { buildAuthoritativeEvidencePack, validateAuthoritativeEvidencePack } from './authoritative-evidence-pack.mjs';

const pack=buildAuthoritativeEvidencePack({
  candidate:{title:'Example launch',link:'https://example.com/story',category:'Technology'},
  sources:[{url:'https://reuters.com/example',domain:'reuters.com',publisherFamily:'reuters.com',title:'Example launch reported',verified:true,passages:['The company announced the product on September 20 2026.'],body:'The company announced the product on September 20 2026.',lineage:{id:'lineage-1',type:'independent',members:1}}],
  coverage:{score:72,band:'usable',independentPublisherFamilies:1},
  blueprint:{mode:'bounded',targetWords:{min:450,max:750}}
});
assert.equal(validateAuthoritativeEvidencePack(pack),true);
assert.equal(pack.sources[0].id,'S1');
assert.equal(pack.sources[0].lineage.id,'lineage-1');
assert.equal(pack.policy.includes('canonical evidence pack'),true);
console.log('Authoritative evidence pack contract: PASS');
