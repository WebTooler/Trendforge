import fs from 'node:fs';

const inputPath = 'data/scored-trends.json';
const outputPath = 'data/source-verification.json';
const credibleDomains = new Set([
  'blog.google', 'support.google.com', 'android.com', 'techcrunch.com', 'bbc.com', 'bbc.co.uk',
  'theguardian.com', 'reuters.com', 'apnews.com', 'nytimes.com', 'washingtonpost.com', 'cnbc.com',
  'arstechnica.com', 'theverge.com', 'wired.com', 'zdnet.com', 'security.googleblog.com',
  'blog.cloudflare.com', 'mistral.ai', 'openai.com', 'anthropic.com', 'microsoft.com', 'apple.com',
]);
const DISCOVERY_TIMEOUT_MS = 7000;
const DISCOVERY_LIMIT = 6;
const MIN_DISCOVERY_OVERLAP = 3;
const DISCOVERY_MIN_SCORE = 50;
const CANDIDATE_CONCURRENCY = 6;
const MIRROR_DOMAINS = new Set(['news.google.com', 'google.com', 'google.co.uk']);

const normalizeUrl = (value) => {
  try { return new URL(value).toString(); } catch { return null; }
};
const domainOf = (value) => {
  try { return new URL(value).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; }
};
const clean = (value = '') => String(value)
  .replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&#(?:x2026;|8230;)/gi, '…').replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/\s+/g, ' ').trim();
const tokens = (value = '') => new Set(clean(value).toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 3));
const topicOverlap = (a, b) => {
  const A = tokens(a); const B = tokens(b);
  return [...A].filter(x => B.has(x)).length;
};

function extractDescriptionLinks(rawDescription) {
  const links = [];
  for (const match of String(rawDescription || '').matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = normalizeUrl(match[1]);
    const text = clean(match[2]);
    if (!url || !text || /^https?:\/\/news\.google\./i.test(url)) continue;
    links.push({ url, text });
  }
  return links;
}

async function fetchText(url) {
  try {
    const response = await fetch(url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(DISCOVERY_TIMEOUT_MS), headers: { 'user-agent': 'TrendForge-source-discovery/2.1' } });
    if (!response.ok) return null;
    return { text: await response.text(), finalUrl: response.url || url };
  } catch { return null; }
}

async function discoverRelatedSources(trend, seedSources) {
  const query = encodeURIComponent(clean(trend.title));
  const rssUrl = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;
  const result = await fetchText(rssUrl);
  if (!result) return [];
  const items = [...result.text.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(m => m[1]);
  const seeds = new Set(seedSources.map(s => domainOf(s.url)).filter(Boolean));
  const relevantItems = items.map(item => {
    const title = clean((item.match(/<title>([\s\S]*?)<\/title>/i) || [,''])[1]);
    const rawDescription = (item.match(/<description>([\s\S]*?)<\/description>/i) || [,''])[1];
    const description = clean(rawDescription);
    const link = normalizeUrl(clean((item.match(/<link>([\s\S]*?)<\/link>/i) || [,''])[1]));
    const sourceMatch = item.match(/<source\b[^>]*\burl=["']([^"']+)["'][^>]*>/i);
    const publisherUrl = normalizeUrl(clean(sourceMatch?.[1] || ''));
    const descriptionLinks = extractDescriptionLinks(rawDescription);
    const overlap = topicOverlap(`${trend.title} ${trend.description || ''}`, `${title} ${description}`);
    return { title, description, link, publisherUrl, descriptionLinks, overlap };
  })
    .filter(item => item.title && item.overlap >= MIN_DISCOVERY_OVERLAP && (item.publisherUrl || item.link || item.descriptionLinks.length))
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, DISCOVERY_LIMIT);

  const discovered = [];
  for (const item of relevantItems) {
    const candidates = [];
    // Google News descriptions often contain related-story anchors with real
    // publisher URLs. Prefer an anchor whose text matches the current story.
    for (const link of item.descriptionLinks) {
      const linkDomain = domainOf(link.url);
      if (!linkDomain || MIRROR_DOMAINS.has(linkDomain) || seeds.has(linkDomain)) continue;
      const linkOverlap = topicOverlap(`${trend.title} ${trend.description || ''}`, link.text);
      candidates.push({ url: link.url, score: linkOverlap + item.overlap, resolvedFrom: 'google-news-description-link' });
    }
    candidates.sort((a, b) => b.score - a.score);

    // Resolve the Google News article pointer when possible. A plain HTTP
    // fetch may remain on Google's wrapper, so it is never counted unless the
    // final URL is a genuine non-Google publisher URL.
    if (item.link) {
      const articleResolved = await fetchText(item.link);
      const articleFinalUrl = normalizeUrl(articleResolved?.finalUrl || '');
      const articleDomain = domainOf(articleFinalUrl);
      if (articleFinalUrl && articleDomain && !MIRROR_DOMAINS.has(articleDomain) && !seeds.has(articleDomain)) {
        candidates.push({ url: articleFinalUrl, score: item.overlap + 1, resolvedFrom: 'google-news-article-link' });
      }
    }

    // Publisher <source url> is identity metadata and therefore only a final
    // fallback. It is deliberately lower priority than an article URL.
    const publisherDomain = domainOf(item.publisherUrl);
    if (item.publisherUrl && publisherDomain && !MIRROR_DOMAINS.has(publisherDomain) && !seeds.has(publisherDomain)) {
      candidates.push({ url: item.publisherUrl, score: 1, resolvedFrom: 'publisher-url-fallback' });
    }

    const chosen = candidates.find(candidate => {
      const d = domainOf(candidate.url);
      return candidate.url && d && !MIRROR_DOMAINS.has(d) && !seeds.has(d);
    });
    if (!chosen) continue;
    const domain = domainOf(chosen.url);
    discovered.push({
      title: item.title,
      url: chosen.url,
      sourceName: domain,
      discovered: true,
      relevanceOverlap: item.overlap,
      resolvedFrom: chosen.resolvedFrom,
    });
    if (discovered.length >= DISCOVERY_LIMIT) break;
  }
  return discovered;
}

async function checkUrl(url) {
  const started = Date.now();
  try {
    const response = await fetch(url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(8000), headers: { 'user-agent': 'TrendForge-source-verifier/2.1' } });
    return { ok: response.ok, status: response.status, finalUrl: response.url || url, latencyMs: Date.now() - started };
  } catch (error) {
    return { ok: false, status: 0, finalUrl: url, latencyMs: Date.now() - started, error: error?.message || String(error) };
  }
}

async function verifyCandidate(trend) {
  const rawSources = Array.isArray(trend.sources) && trend.sources.length
    ? trend.sources
    : [{ title: trend.sourceName || trend.title, url: trend.sourceUrl || trend.link }];
  const seedSources = rawSources.map(source => ({ ...source, url: normalizeUrl(source.url) })).filter(source => source.url);
  const seedDomains = new Set(seedSources.map(source => domainOf(source.url)).filter(domain => domain && !MIRROR_DOMAINS.has(domain)));
  const score = Number(trend.score ?? trend.finalScore ?? trend.priorityScore ?? 0);
  const discoveryEligible = seedDomains.size < 2 && (score >= DISCOVERY_MIN_SCORE || seedDomains.size === 0);
  const discovered = discoveryEligible ? await discoverRelatedSources(trend, seedSources) : [];

  const combined = [...seedSources, ...discovered];
  const deduped = [];
  const seenUrls = new Set();
  for (const source of combined) {
    const url = normalizeUrl(source.url);
    if (!url || seenUrls.has(url)) continue;
    seenUrls.add(url);
    deduped.push({ ...source, url });
  }

  const checks = [];
  for (const source of deduped.slice(0, 8)) {
    const domain = domainOf(source.url);
    if (MIRROR_DOMAINS.has(domain)) continue;
    const check = await checkUrl(source.url);
    const finalDomain = domainOf(check.finalUrl || source.url);
    checks.push({
      title: source.title || '', url: source.url, domain: finalDomain || domain,
      credibleDomain: credibleDomains.has(finalDomain || domain), discovered: Boolean(source.discovered),
      relevanceOverlap: source.relevanceOverlap || 0, resolvedFrom: source.resolvedFrom || 'seed', ...check,
    });
  }

  const reachable = checks.filter(item => item.ok);
  const credible = reachable.filter(item => item.credibleDomain);
  const uniqueDomains = new Set(reachable.map(item => item.domain).filter(d => d && !MIRROR_DOMAINS.has(d)));
  const relevantReachable = reachable.filter(item => !item.discovered || item.relevanceOverlap >= MIN_DISCOVERY_OVERLAP);
  const confidence = Math.round(
    (checks.length ? reachable.length / checks.length : 0) * 45 +
    (checks.length ? credible.length / checks.length : 0) * 25 +
    Math.min(uniqueDomains.size / 2, 1) * 20 +
    Math.min(relevantReachable.length / 2, 1) * 10,
  );

  return {
    link: trend.link, title: trend.title, category: trend.category,
    verifiedAt: new Date().toISOString(), sourceCount: checks.length,
    discoveredSourceCount: discovered.length, reachableSourceCount: reachable.length,
    credibleSourceCount: credible.length, uniqueDomainCount: uniqueDomains.size,
    independentReachableDomains: [...uniqueDomains], relevantReachableSourceCount: relevantReachable.length,
    confidence, status: confidence >= 70 ? 'verified' : confidence >= 45 ? 'partial' : 'unverified',
    discovery: {
      enabled: discoveryEligible, queryTitle: discoveryEligible ? trend.title : null,
      sameStoryOnly: true, minTopicOverlap: MIN_DISCOVERY_OVERLAP,
      googleNewsIsIndexOnly: true, resolvedPublisherLinks: true,
      descriptionArticleLinksEnabled: true,
      minScore: DISCOVERY_MIN_SCORE, seedDomainCount: seedDomains.size,
    },
    sources: checks,
  };
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function runWorker() {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => runWorker()));
  return results;
}

if (!fs.existsSync(inputPath)) {
  console.log(`No ${inputPath}; source verification skipped.`);
  process.exit(0);
}

const research = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const trends = research.trends ?? [];
const startedAt = Date.now();
const records = await mapWithConcurrency(trends, CANDIDATE_CONCURRENCY, verifyCandidate);
const durationMs = Date.now() - startedAt;

fs.mkdirSync('data', { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify({ version: 2, generatedAt: new Date().toISOString(), durationMs, candidateConcurrency: CANDIDATE_CONCURRENCY, discoveryMinScore: DISCOVERY_MIN_SCORE, records }, null, 2)}\n`);

const verified = records.filter(record => record.status === 'verified').length;
const partial = records.filter(record => record.status === 'partial').length;
const unverified = records.filter(record => record.status === 'unverified').length;
const discovered = records.reduce((sum, record) => sum + record.discoveredSourceCount, 0);
const independentDomains = records.reduce((sum, record) => sum + record.uniqueDomainCount, 0);
const discoveryEnabled = records.filter(record => record.discovery?.enabled).length;
console.log(`Source Verification v2: ${records.length} candidate(s) checked — ${verified} verified, ${partial} partial, ${unverified} unverified.`);
console.log(`Evidence discovery: ${discovered} discovered publisher source(s), ${independentDomains} candidate-level independent reachable domain(s).`);
console.log(`Evidence discovery: ${discoveryEnabled} candidate(s) enriched (score >= ${DISCOVERY_MIN_SCORE} or no independent seed domain).`);
console.log(`Evidence discovery: candidate-scoped Google News discovery, topic overlap >= ${MIN_DISCOVERY_OVERLAP}, Google domains excluded from independent-source counts, publisher article links resolved.`);
console.log(`Evidence discovery: Google News description article-link recovery enabled.`);
console.log(`Evidence discovery runtime: ${durationMs}ms with bounded candidate concurrency ${CANDIDATE_CONCURRENCY}.`);