const GOOGLE_NEWS_HOSTS = new Set(['news.google.com']);
const GOOGLE_NEWS_PATH_RE = /^\/rss\/articles\/([^/]+)$/;

function isGoogleNewsArticleUrl(value = '') {
  try {
    const url = new URL(value);
    return GOOGLE_NEWS_HOSTS.has(url.hostname.toLowerCase()) && GOOGLE_NEWS_PATH_RE.test(url.pathname);
  } catch {
    return false;
  }
}

function articleIdFromUrl(value = '') {
  try {
    const url = new URL(value);
    const match = url.pathname.match(GOOGLE_NEWS_PATH_RE);
    return match?.[1] || '';
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
    [
      ['en-US', 'US', ['FINANCE_TOP_INDICES', 'WEB_TEST_1_0_0'], null, null, 1, 1, 'US:en', null, 1, null, null, null, null, null, 0, 1],
      'en-US',
      'US',
      1,
      [1, 1, 1],
      1,
      1,
      null,
      0,
      0,
      null,
      0
    ],
    sourceId,
    Number(timestamp),
    signature
  ]);
  const request = [['Fbv4je', inner, null, 'generic']];
  return `f.req=${encodeURIComponent(JSON.stringify([request]))}`;
}

function extractResolvedUrl(payload = '') {
  const separatorIndex = payload.indexOf('\n\n');
  const body = separatorIndex >= 0 ? payload.slice(separatorIndex + 2) : payload;
  try {
    const outer = JSON.parse(body);
    const candidate = outer?.[0]?.[2];
    if (typeof candidate !== 'string') return '';
    const decoded = JSON.parse(candidate);
    return typeof decoded?.[1] === 'string' ? decoded[1] : '';
  } catch {
    return '';
  }
}

export async function resolveGoogleNewsUrl(value = '', { timeoutMs = 8000 } = {}) {
  if (!isGoogleNewsArticleUrl(value)) return value || null;

  const articleId = articleIdFromUrl(value);
  if (!articleId) return null;

  try {
    const page = await fetch(`https://news.google.com/rss/articles/${encodeURIComponent(articleId)}`, {
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9',
        'cache-control': 'no-cache',
        referer: 'https://news.google.com/'
      }
    });
    if (!page.ok) return null;

    const html = await page.text();
    const params = extractDecodeParams(html, articleId);
    if (!params) return null;

    const response = await fetch('https://news.google.com/_/DotsSplashUi/data/batchexecute?rpcids=Fbv4je', {
      method: 'POST',
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
        accept: '*/*',
        origin: 'https://news.google.com',
        referer: 'https://news.google.com/'
      },
      body: buildRequestBody(params)
    });
    if (!response.ok) return null;

    const resolved = extractResolvedUrl(await response.text());
    if (!resolved || isGoogleNewsArticleUrl(resolved)) return null;

    try {
      const url = new URL(resolved);
      return url.protocol === 'https:' ? url.toString() : null;
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

export const googleNewsResolverInternals = {
  isGoogleNewsArticleUrl,
  articleIdFromUrl,
  extractDecodeParams,
  buildRequestBody,
  extractResolvedUrl
};
