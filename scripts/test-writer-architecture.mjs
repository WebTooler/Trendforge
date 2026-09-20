import assert from 'node:assert/strict';
import { validateDraft } from './trendforge-editorial-policy.mjs';
const base={title:'A sufficiently descriptive TrendForge headline',description:'A sufficiently long description that explains the development and gives readers useful context without making unsupported claims.',category:'Technology'};
const content='## One\n\nSupported detail one. Supported detail two.\n\n## Two\n\nSupported detail three. Supported detail four.\n\n## Three\n\nSupported detail five. Supported detail six.\n\n## Four\n\nSupported detail seven. Supported detail eight.\n\n## Five\n\nSupported detail nine. Supported detail ten.\n\n## Six\n\nSupported detail eleven. Supported detail twelve.';
const result=validateDraft({...base,content,blueprint:{maxH2:5}});
assert.equal(result.passed,false);
assert.ok(result.errors.some(x=>x.includes('H2 count 6 exceeds evidence blueprint maximum 5')));
console.log('Phase 4 Writer 3.0 H2 architecture guard passed.');
