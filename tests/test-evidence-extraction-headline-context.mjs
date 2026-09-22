import assert from 'node:assert/strict';
import { extractEvidenceFromHtml } from '../scripts/evidence-extraction.mjs';

const html=`<html><head><script type="application/ld+json">{"@type":"NewsArticle","headline":"Bitcoin opens at $86,597.82 as Ethereum starts at $2,775.96","description":"Crypto prices moved higher.","articleBody":"Bitcoin opened at $86,597.82 as traders watched the market. Ethereum opened at $2,775.96 in early trading. Analysts discussed whether the crypto winter was ending. The unrelated paragraph discusses laptops and batteries."}</script></head><body>
<p>Bitcoin opened at $86,597.82 as traders watched the market.</p>
<p>Ethereum opened at $2,775.96 in early trading.</p>
<p>Analysts discussed whether the crypto winter was ending.</p>
<p>The unrelated paragraph discusses laptops and batteries.</p>
</body></html>`;
const out=extractEvidenceFromHtml(html,'Bitcoin and ethereum prices today','Bitcoin opens at $86,597.82 as Ethereum starts at $2,775.96');
assert.ok(out.passages.some(x=>x.includes('$86,597.82')),'bitcoin evidence must survive headline mismatch');
assert.ok(out.passages.some(x=>x.includes('$2,775.96')),'ethereum evidence must survive headline mismatch');
assert.ok(out.passages.length>=3,'should retain enough evidence units');
console.log('PASS: evidence extraction uses source headline/context and preserves claim-grade numeric evidence');
