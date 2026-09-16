import fs from 'node:fs/promises';

const inputPath = 'data/source-verification.json';
const timeoutMs = 7000;
const maxPerRecord = 4;
const recoveryConcurrency = 8;
const secondLevel = new Set(['co.uk','co.in','co.jp','co.nz','co.au','com.br','com.cn']);
const domainOf = (value = '') => { try { return new URL(value).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } };
const familyOf = (value = '') => { const host = domainOf(value); if (!host) return ''; const parts = host.split('.'); if (parts.length < 2) return host; const suffix = parts.slice(-2).join('.'); return secondLevel.has(suffix) && parts.length >= 3 ? parts.slice(-3).join('.') : suffix; };
const normalize = (value = '') => { try { const url = new URL(value); return url.protocol === 'https:' ? url.toString() : null; } catch { return null; } };
const mirror = new Set(['news.google.com', 'google.com', 'google.co.uk', 'bing.com', 'www.bing.com']);
const blocked = new Set(['facebook.com','reddit.com','pinterest.com','youtube.com','tiktok.com','x.com']);
const homepage = (value = '') => { try { const u = new URL(value); return !u.pathname || u.pathname === '/' || u.pathname.length < 8; } catch { return true; } };
const feed = (value = '') => { try { const u = new URL(value); return /^feeds?\.|^rss\.|^feed\./i.test(u.hostname) || /(^|\/)(rss|feed|feeds|atom|sitemap)(\/|\.|$)/i.test(u.pathname); } catch { return true; } };
const decode = (value = '') => String(value)
  .replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '')
  .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&#x27;/gi, "'")
  .replace(/&nbsp;|&#160;/gi, ' ');
const clean = (value = '') => decode(value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const stop = new Set(['about','after','again','also','been','being','could','from','have','into','more','most','over','said','some','than','that','their','there','these','they','this','what','when','which','with','will','would','your','technology','tech','digital','latest','news','update','updates','guide','today','artificial','intelligence','company','companies','industry','development','developments','story','stories','article','articles','exclusive','report']);
const tokens = (value = '') => new Set(clean(value).toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 3 && !stop.has(w)));
const overlap = (a = '', b = '') => { const A = tokens(a); const B = tokens(b); return [...A].filter(w => B.has(w)).length; };

async function get(url, accept = 'text/html,application/xml;q=0.9,*/*;q=0.8') {
  try {
    const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(timeoutMs), headers: { 'user-agent': 'TrendForge-source-recovery/1.4', accept } });
    if (!r.ok) return null;
    return { text: await r.text(), finalUrl: r.url || url };
  } catch { return null; }
}

function linksFromRss(xml = '') {
  const out = [];
  for (const block of xml.match(/<item\b[\s\S]*?<\/item>/gi) || []) {
    const title = clean((block.match(/<title>([\s\S]*?)<\/title>/i) || [, ''])[1]);
    const descriptionRaw = (block.match(/<description>([\s\S]*?)<\/description>/i) || [, ''])[1];
    const description = decode(descriptionRaw);
    const itemLink = normalize(clean((block.match(/<link>([\s\S]*?)<\/link>/i) || [, ''])[1]));
    const descriptionLinks = [...String(description).matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
      .map(m => ({ url: normalize(decode(m[1])), text: clean(m[2]) }))
      .filter(x => x.url && !mirror.has(domainOf(x.url)) && !blocked.has(domainOf(x.url)) && !homepage(x.url) && !feed(x.url));
    if (!title) continue;
    for (const link of descriptionLinks) out.push({ title, url: link.url, linkText: link.text, source: 'description-link' });
    if (itemLink && !mirror.has(domainOf(itemLink)) && !blocked.has(domainOf(itemLink)) && !homepage(itemLink) && !feed(itemLink)) out.push({ title, url: itemLink, linkText: '', source: 'item-link' });
  }
  return out;
}

function extractSearchLinks(html = '', engine = 'bing') {
  const out = [];
  const source = decode(html);
  const pattern = engine === 'google'
    ? /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
    : /<li\b[^>]*class=["'][^"']*b_algo[^"']*[\s\S]*?<h2[^>]*>\s*<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const m of source.matchAll(pattern)) {
    let href = clean(m[1]);
    const text = clean(m[2]);
    if (engine === 'google') {
      try {
        const u = new URL(href, 'https://www.google.com');
        if (u.pathname === '/url' && u.searchParams.get('q')) href = u.searchParams.get('q');
        else if (u.hostname === 'www.google.com' || u.hostname === 'google.com') continue;
      } catch { continue; }
    }
    const url = normalize(href); const domain = domainOf(url || '');
    if (!url || !domain || mirror.has(domain) || blocked.has(domain) || homepage(url) || feed(url)) continue;
    out.push({ url, text, source: `${engine}-web-search` });
  }
  return out;
}

async function recoverFromWebSearch(title, existingFamilies) {
  const queries = [`"${title}"`, title];
  const found = [];
  const seen = new Set();
  for (const query of queries) {
    const encoded = encodeURIComponent(query);
    for (const [engine, url] of [
      ['bing', `https://www.bing.com/search?q=${encoded}&count=20`],
      ['google', `https://www.google.com/search?q=${encoded}&num=20`],
    ]) {
      const result = await get(url);
      if (!result) continue;
      for (const item of extractSearchLinks(result.text, engine)) {
        const d = domainOf(item.url); const f = familyOf(item.url);
        if (!d || !f || existingFamilies.has(f) || seen.has(item.url)) continue;
        const itemOverlap = overlap(title, item.text);
        if (itemOverlap < 2) continue;
        seen.add(item.url);
        found.push({ ...item, relevanceOverlap: itemOverlap });
        if (found.length >= maxPerRecord || new Set(found.map(x => familyOf(x.url))).size >= 2) return found;
      }
    }
  }
  return found;
}

async function recover(record) {
  const current = Array.isArray(record.sources) ? record.sources : [];
  const existingFamilies = new Set(current.map(s => familyOf(s.finalUrl || s.url)).filter(Boolean));
  if (existingFamilies.size >= 2) return record;
  const title = clean(record.title || ''); if (!title) return record;
  const queries = [`"${title}"`, title];
  const additions = [];
  const seen = new Set();

  // First use news indexes because they are cheap and candidate-scoped. They are
  // discovery only; every recovered URL is revalidated by Evidence Integrity.
  const feeds = [];
  for (const query of queries) {
    const encoded = encodeURIComponent(query);
    feeds.push(`https://www.bing.com/news/search?q=${encoded}&format=rss`);
    feeds.push(`https://news.google.com/rss/search?q=${encoded}&hl=en-US&gl=US&ceid=US:en`);
  }
  for (const feedUrl of feeds) {
    const result = await get(feedUrl, 'application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.8');
    if (!result) continue;
    for (const item of linksFromRss(result.text).sort((a,b) => overlap(title,b.title) - overlap(title,a.title))) {
      const d = domainOf(item.url); const f = familyOf(item.url);
      if (!d || !f || mirror.has(d) || blocked.has(d) || existingFamilies.has(f) || seen.has(item.url) || homepage(item.url) || feed(item.url)) continue;
      const itemOverlap = overlap(title, item.title);
      if (itemOverlap < 2) continue;
      seen.add(item.url);
      additions.push({ title: item.title, url: item.url, finalUrl: item.url, domain: d, publisherFamily: f, ok: true, status: 200, discovered: true, relevanceOverlap: itemOverlap, recovery: true, resolvedFrom: result.finalUrl.includes('bing.com') ? `bing-news-${item.source}` : `google-news-${item.source}` });
      existingFamilies.add(f);
      if (existingFamilies.size >= 2 || additions.length >= maxPerRecord) break;
    }
    if (existingFamilies.size >= 2 || additions.length >= maxPerRecord) break;
  }

  // RSS often exposes only an index/redirect URL. If it yields nothing, use the
  // web search result page strictly as a discovery index. Search-result URLs are
  // never evidence; Evidence Integrity must fetch and validate the publisher page.
  if (existingFamilies.size < 2 && additions.length < maxPerRecord) {
    const webCandidates = await recoverFromWebSearch(title, existingFamilies);
    for (const item of webCandidates) {
      const d = domainOf(item.url); const f = familyOf(item.url);
      if (!d || !f || existingFamilies.has(f) || seen.has(item.url)) continue;
      seen.add(item.url);
      additions.push({ title, url: item.url, finalUrl: item.url, domain: d, publisherFamily: f, ok: true, status: 200, discovered: true, relevanceOverlap: item.relevanceOverlap, recovery: true, resolvedFrom: item.source });
      existingFamilies.add(f);
      if (existingFamilies.size >= 2 || additions.length >= maxPerRecord) break;
    }
  }

  if (!additions.length) return { ...record, recovery: { attempted: true, added: 0, independentPublisherFamilies: [] } };
  const sources = [...current, ...additions];
  return { ...record, sources, sourceCount: sources.length, reachableSourceCount: sources.filter(s => s.ok).length, uniqueDomainCount: new Set(sources.map(s => domainOf(s.finalUrl || s.url)).filter(Boolean)).size, independentReachableDomains: [...new Set(sources.map(s => domainOf(s.finalUrl || s.url)).filter(Boolean))], recovery: { attempted: true, added: additions.length, independentPublisherFamilies: [...new Set(additions.map(s => s.publisherFamily))], methods: [...new Set(additions.map(s => s.resolvedFrom))] } };
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length); let next = 0;
  async function runWorker() { while (true) { const index = next++; if (index >= items.length) return; results[index] = await worker(items[index], index); } }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runWorker));
  return results;
}

try {
  const raw = await fs.readFile(inputPath, 'utf8');
  const report = JSON.parse(raw); const records = Array.isArray(report.records) ? report.records : [];
  const recovered = await mapWithConcurrency(records, recoveryConcurrency, recover);
  const attempted = recovered.filter(r => r.recovery?.attempted).length;
  const added = recovered.reduce((sum, r) => sum + Number(r.recovery?.added || 0), 0);
  await fs.writeFile(inputPath, `${JSON.stringify({ ...report, version: 8, recoveredAt: new Date().toISOString(), recoverySummary: { attempted, added }, records: recovered }, null, 2)}\n`);
  console.log(`Publisher recovery v3: checked ${records.length} verification record(s) with bounded concurrency ${recoveryConcurrency}.`);
  console.log(`Publisher recovery v3: ${attempted} record(s) attempted recovery; ${added} publisher URL(s) discovered. RSS discovery is followed by bounded Bing/Google web-search discovery when RSS exposes only index/redirect links.`);
} catch (error) { console.log(`Publisher recovery skipped: ${error instanceof Error ? error.message : String(error)}`); }
