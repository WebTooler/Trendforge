import fs from 'node:fs';

const inputPath = 'data/scored-trends.json';
const outputPath = 'data/source-verification.json';
const credibleDomains = new Set([
  'blog.google', 'support.google.com', 'android.com', 'techcrunch.com', 'bbc.com', 'bbc.co.uk',
  'theguardian.com', 'reuters.com', 'apnews.com', 'nytimes.com', 'washingtonpost.com', 'cnbc.com',
  'arstechnica.com', 'theverge.com', 'wired.com', 'zdnet.com', 'security.googleblog.com',
  'blog.cloudflare.com', 'mistral.ai', 'openai.com', 'anthropic.com', 'microsoft.com', 'apple.com',
]);

const normalizeUrl = (value) => {
  try { return new URL(value).toString(); } catch { return null; }
};
const domainOf = (value) => {
  try { return new URL(value).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; }
};

async function checkUrl(url) {
  const started = Date.now();
  try {
    const response = await fetch(url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(8000), headers: { 'user-agent': 'TrendForge-source-verifier/1.0' } });
    return { ok: response.ok, status: response.status, finalUrl: response.url || url, latencyMs: Date.now() - started };
  } catch (error) {
    return { ok: false, status: 0, finalUrl: url, latencyMs: Date.now() - started, error: error?.message || String(error) };
  }
}

if (!fs.existsSync(inputPath)) {
  console.log(`No ${inputPath}; source verification skipped.`);
  process.exit(0);
}

const research = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const trends = research.trends ?? [];
const records = [];

for (const trend of trends) {
  const rawSources = Array.isArray(trend.sources) && trend.sources.length
    ? trend.sources
    : [{ title: trend.sourceName || trend.title, url: trend.sourceUrl || trend.link }];
  const sources = rawSources.map((source) => ({ ...source, url: normalizeUrl(source.url) })).filter((source) => source.url);
  const checks = [];
  for (const source of sources.slice(0, 4)) {
    const domain = domainOf(source.url);
    const check = await checkUrl(source.url);
    checks.push({ title: source.title || '', url: source.url, domain, credibleDomain: credibleDomains.has(domain), ...check });
  }

  const reachable = checks.filter((item) => item.ok);
  const credible = checks.filter((item) => item.ok && item.credibleDomain);
  const uniqueDomains = new Set(checks.map((item) => item.domain).filter(Boolean));
  const confidence = Math.round(
    (checks.length ? reachable.length / checks.length : 0) * 45 +
    (checks.length ? credible.length / checks.length : 0) * 35 +
    Math.min(uniqueDomains.size / 2, 1) * 20,
  );

  records.push({
    link: trend.link,
    title: trend.title,
    category: trend.category,
    verifiedAt: new Date().toISOString(),
    sourceCount: checks.length,
    reachableSourceCount: reachable.length,
    credibleSourceCount: credible.length,
    uniqueDomainCount: uniqueDomains.size,
    confidence,
    status: confidence >= 70 ? 'verified' : confidence >= 45 ? 'partial' : 'unverified',
    sources: checks,
  });
}

fs.mkdirSync('data', { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), records }, null, 2)}\n`);

const verified = records.filter((record) => record.status === 'verified').length;
const partial = records.filter((record) => record.status === 'partial').length;
const unverified = records.filter((record) => record.status === 'unverified').length;
console.log(`Source Verification v1: ${records.length} candidate(s) checked — ${verified} verified, ${partial} partial, ${unverified} unverified.`);
