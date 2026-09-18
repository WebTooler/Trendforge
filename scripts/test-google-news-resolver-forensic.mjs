import fs from 'node:fs';

const TIMEOUT_MS = 12000;
const SAMPLE_SIZE = 20;

function articleIdFromUrl(value = '') {
  try {
    const url = new URL(value);
    return url.pathname.match(/^\/rss\/articles\/([^/]+)$/)?.[1] || '';
  } catch {
    return '';
  }
}

function extractDecodeParams(html = '', articleId = '') {
  const escaped = String(html);
  const idPattern = articleId ? articleId.replace(/[.*+?^$\{}()|[\]\\]/g, '\\$&') : '';
  const preferred = idPattern
    ? new RegExp(`<div\\b[^>]*data-n-a-id=["']${idPattern}["'][^>]*>`, 'i')
    : null;
  const scoped = preferred ? escaped.match(preferred)?.[0] || '' : '';
  const signature = (scoped || escaped).match(/data-n-a-sg=["']([^"']+)["']/i)?.[1] || '';
  const timestamp = (scoped || escaped).match(/data-n-a-ts=["'](\\d+)["']/i)?.[1] || '';
  const sourceId = (scoped || escaped).match(/data-n-a-id=["']([^"']+)["']/i)?.[1] || articleId;
  if (!signature || !timestamp || !sourceId) return null;
  return { sourceId, signature, timestamp };
}

function buildRequestBody({ sourceId, signature, timestamp }) {
  const inner = JSON.stringify([
    'garturlreq',
    [['en-US', 'US', ['FINANCE_TOP_INDICES', 'WEB_TEST_1_0_0'], null, null, 1, 1, 'US:en', null, 1, null, null, null, null, null, 0, 1],
      'en-US', 'US', 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0],
    sourceId, Number(timestamp), signature
  ]);
  return `f.req=${encodeURIComponent(JSON.stringify([[['Fbv4je', inner, null, 'generic']]]))}`;
}

function extractResolvedUrl(payload = '') {
  const body = payload.includes('\\n\\n') ? payload.slice(payload.indexOf('\\n\\n') + 2) : payload;
  try {
    const outer = JSON.parse(body);
    const candidate = outer?.[0]?.[2];
    if (typeof candidate !== 'string') return '';
    const decoded = JSON.parse(candidate);
    return typeof decoded?.[1] === 'string' ? decoded[1] : '';
  } catch { return ''; }
}

async function probe(value) {
  const result = { input: value, stages: {} };
  const id = articleIdFromUrl(value);
  result.articleId = id;
  if (!id) return Object.assign(result, { failure: 'invalid_article_id' });

  try {
    const page = await fetch(`https://news.google.com/rss/articles/${encodeURIComponent(id)}`, {
      redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/129 Safari/537.36',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9', referer: 'https://news.google.com/'
      }
    });
    result.stages.page = { ok: page.ok, status: page.status, contentType: page.headers.get('content-type') || '' };
    const html = await page.text();
    result.stages.page.bytes = Buffer.byteLength(html);
    result.stages.page.hasDataId = html.includes('data-n-a-id');
    result.stages.page.hasSignature = html.includes('data-n-a-sg');
    result.stages.page.hasTimestamp = html.includes('data-n-a-ts');
    const params = extractDecodeParams(html, id);
    result.stages.params = params ? { found: true } : { found: false };
    if (!params) return Object.assign(result, { failure: 'decode_params_missing' });

    const response = await fetch('https://news.google.com/_/DotsSplashUi/data/batchexecute?rpcids=Fbv4je', {
      method: 'POST', signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/129 Safari/537.36',
        accept: '*/*', origin: 'https://news.google.com', referer: 'https://news.google.com/'
      },
      body: buildRequestBody(params)
    });
    result.stages.batchexecute = { ok: response.ok, status: response.status, contentType: response.headers.get('content-type') || '' };
    const payload = await response.text();
    result.stages.batchexecute.bytes = Buffer.byteLength(payload);
    result.stages.batchexecute.hasGarturlres = payload.includes('garturlres');
    result.stages.batchexecute.hasRateLimitMarker = /httprm|429|captcha/i.test(payload);
    const resolved = extractResolvedUrl(payload);
    result.stages.resolution = { found: Boolean(resolved), host: resolved ? new URL(resolved).hostname : '' };
    if (!resolved) result.failure = 'publisher_url_missing';
    return result;
  } catch (error) {
    result.failure = error?.name === 'TimeoutError' ? 'timeout' : String(error?.message || error);
    return result;
  }
}

const data = JSON.parse(fs.readFileSync('data/trend-candidates.json', 'utf8'));
const candidates = (data.candidates || []).filter(x => /^https:\/\/news\.google\.com\/rss\/articles\//.test(x.link));
const sample = candidates.slice(0, SAMPLE_SIZE);
console.log(`Forensic Google News resolver probe: ${sample.length}/${candidates.length} sampled`);

const results = [];
for (const candidate of sample) {
  const r = await probe(candidate.link);
  results.push({ title: candidate.title, ...r });
  console.log(JSON.stringify({ title: candidate.title, failure: r.failure || null, stages: r.stages }, null, 2));
}

const summary = {};
for (const r of results) summary[r.failure || 'resolved'] = (summary[r.failure || 'resolved'] || 0) + 1;
console.log('FORENSIC SUMMARY:', JSON.stringify(summary));
