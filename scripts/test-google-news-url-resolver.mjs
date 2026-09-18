import assert from 'node:assert/strict';
import { googleNewsResolverInternals as r } from './google-news-url-resolver.mjs';

const googleUrl = 'https://news.google.com/rss/articles/CBMiTESTARTICLE?oc=5';

assert.equal(r.isGoogleNewsArticleUrl(googleUrl), true);
assert.equal(r.isGoogleNewsArticleUrl('https://example.com/article'), false);
assert.equal(r.articleIdFromUrl(googleUrl), 'CBMiTESTARTICLE');

const html = '<c-wiz><div data-n-a-id="CBMiTESTARTICLE" data-n-a-sg="signature-value" data-n-a-ts="123456789"></div></c-wiz>';
assert.deepEqual(r.extractDecodeParams(html, 'CBMiTESTARTICLE'), {
  sourceId: 'CBMiTESTARTICLE',
  signature: 'signature-value',
  timestamp: '123456789'
});

const body = r.buildRequestBody({
  sourceId: 'CBMiTESTARTICLE',
  signature: 'signature-value',
  timestamp: '123456789'
});
assert.match(body, /^f\.req=/);
assert.match(decodeURIComponent(body), /Fbv4je/);
assert.match(decodeURIComponent(body), /garturlreq/);
assert.match(decodeURIComponent(body), /CBMiTESTARTICLE/);

const nested = JSON.stringify([[null, null, JSON.stringify(['garturlres', 'https://www.reuters.com/world/example'])]]);
assert.equal(r.extractResolvedUrl(')]}\'\n\n' + nested), 'https://www.reuters.com/world/example');

console.log('Google News resolver deterministic test: PASS');
