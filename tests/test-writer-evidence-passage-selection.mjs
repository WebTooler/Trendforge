import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync('scripts/generate-article.ts','utf8');

assert.ok(source.includes('const sourceId=`S${i+1}`;'),'writer evidence selection must address canonical source IDs');
assert.match(source,/\(s as any\)\.extraction\?\.relevantPassages/,'writer evidence selection must resolve immutable raw passage metadata');
assert.match(source,/extraction:source\.extraction\|\|null/,'evidence pack must preserve extraction metadata from the authoritative pack');
assert.match(source,/byRawIndex\.set\(rawIndex,p\.text\)/,'writer evidence selection must map raw passage IDs to exact text');
assert.match(source,/corePassageRefs\.get\(sourceId\)/,'writer evidence selection must use fact-map source IDs');
assert.match(source,/const fallback=s\.passages\.slice\(0,3\)/,'writer fallback should retain multiple evidence passages');
assert.match(source,/slice\(0,8\)\.map\(x=>x\.slice\(0,900\)/,'writer should retain multiple selected evidence passages per source');
assert.doesNotMatch(source,/corePassageRefs\.get\(String\(sourceIdFor\(s\)\)\)/,'writer must not key fact-map refs by publisher family');
assert.doesNotMatch(source,/const fallback=s\.passages\.slice\(0,1\)/,'writer must not silently fall back to one passage per source');

console.log('Writer evidence passage selection regression: PASS');
