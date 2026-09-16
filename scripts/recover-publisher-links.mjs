import fs from 'node:fs/promises';

const inputPath = 'data/source-verification.json';
const timeoutMs = 9000;
const maxPerRecord = 4;
const recoveryConcurrency = 8;
const mirrors = new Set(['news.google.com', 'google.com', 'google.co.uk', 'bing.com', 'www.bing.com']);
const blocked = new Set(['facebook.com', 'reddit.com', 'pinterest.com', 'youtube.com', 'tiktok.com', 'x.com']);
const secondLevel = new Set(['co.uk', 'co.in', 'co.jp', 'co.nz', 'co.au', 'com.br', 'com.cn']);
const stop = new Set(['about','after','again','also','been','being','could','from','have','into','more','most','over','said','some','than','that','their','there','these','they','this','what','when','which','with','will','would','your','technology','tech','digital','latest','news','update','updates','guide','today','artificial','intelligence','company','companies','industry','development','developments','story','stories','article','articles','exclusive','report']);

const host = (value = '') => { try { return new URL(value).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } };
const family = (value = '') => { const h = host(value); if (!h) return ''; const p = h.split('.'); if (p.length < 2) return h; const suffix = p.slice(-2).join('.'); return secondLevel.has(suffix) && p.length >= 3 ? p.slice(-3).join('.') : suffix; };
const normalize = (value = '') => { try { const u = new URL(value); return u.protocol === 'https:' ? u.toString() : null; } catch { return null; } };
const homepage = (value = '') => { try { const u = new URL(value); return !u.pathname || u.pathname === '/' || u.pathname.length < 8; } catch { return true; } };
const feed = (value = '') => { try { const u = new URL(value); return /^feeds?\.|^rss\.|^feed\./i.test(u.hostname) || /(^|\/)(rss|feed|feeds|atom|sitemap)(\/|\.|$)/i.test(u.pathname) || /(^|&)(feed|rss|atom|format)=/i.test(u.search.slice(1)); } catch { return true; } };
const clean = (value = '') => String(value).replace(/<!\[CDATA\[/gi, ' ').replace(/\]\]>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;|&#x27;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&nbsp;|&#160;/gi, ' ').replace(/\s+/g, ' ').trim();
const tokens = (value = '') => new Set(clean(value).toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 3 && !stop.has(w)));
const overlap = (a = '', b = '') => { const A = tokens(a); const B = tokens(b); return [...A].filter(x => B.has(x)).length; };

async function get(url, accept = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8') {
  try { const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(timeoutMs), headers: { 'user-agent': 'TrendForge-source-recovery/2.0', accept } }); if (!r.ok) return null; return { text: await r.text(), finalUrl: r.url || url }; } catch { return null; }
}

function descriptionLinks(raw = '') {
  const out = [];
  const decoded = raw.replace(/&amp;/gi, '&').replace(/&quot;/gi, '"');
  for (const m of decoded.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = normalize(clean(m[1]));
    if (url && !mirrors.has(host(url)) && !blocked.has(host(url)) && !homepage(url) && !feed(url)) out.push({ url, text: clean(m[2]) });
  }
  return out;
}

function parseFeed(xml = '') {
  const out = [];
  const blocks = [
    ...[...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map(m => m[0]),
    ...[...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)].map(m => m[0]),
  ];
  for (const block of blocks) {
    const title = clean((block.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [, ''])[1]);
    const rawDescription = (block.match(/<(?:description|summary|content)(?:\s[^>]*)?>([\s\S]*?)<\/(?:description|summary|content)>/i) || [, ''])[1];
    const description = clean(rawDescription);
    const urls = [];
    for (const m of block.matchAll(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/gi)) urls.push(normalize(clean(m[1])));
    const textLink = normalize(clean((block.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || [, ''])[1]));
    if (textLink) urls.push(textLink);
    for (const l of descriptionLinks(rawDescription)) urls.push(l.url);
    for (const url of [...new Set(urls)]) if (url && !mirrors.has(host(url)) && !blocked.has(host(url)) && !homepage(url) && !feed(url)) out.push({ title, description, url });
  }
  return out;
}

async function validatePublisherPage(url, storyTitle) {
  const result = await get(url);
  if (!result) return null;
  const finalUrl = normalize(result.finalUrl || url);
  if (!finalUrl || mirrors.has(host(finalUrl)) || blocked.has(host(finalUrl)) || homepage(finalUrl) || feed(finalUrl)) return null;
  const html = result.text;
  const pageTitle = clean((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [, ''])[1]);
  const h1 = clean((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [, ''])[1]);
  const body = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map(m => clean(m[1])).filter(x => x.length >= 45 && x.length <= 3000).slice(0, 80).join(' ');
  if (body.length < 500) return null;
  if (Math.max(overlap(storyTitle, `${pageTitle} ${h1}`), overlap(storyTitle, body)) < 2) return null;
  return { finalUrl, pageTitle, bodyChars: body.length };
}

async function recover(record) {
  const current = Array.isArray(record.sources) ? record.sources : [];
  const existingFamilies = new Set(current.map(s => family(s.finalUrl || s.url)).filter(Boolean));
  if (existingFamilies.size >= 2) return record;
  const title = clean(record.title || '');
  if (!title) return record;
  const queries = [title, [...tokens(title)].slice(0, 8).join(' ')].filter(Boolean);
  const additions = [];
  const seen = new Set();

  for (const query of queries) {
    const encoded = encodeURIComponent(query);
    const feeds = [
      `https://news.google.com/rss/search?q=${encoded}&hl=en-US&gl=US&ceid=US:en`,
      `https://www.bing.com/news/search?q=${encoded}&format=rss`,
    ];
    for (const feedUrl of feeds) {
      const result = await get(feedUrl, 'application/rss+xml,application/atom+xml,application/xml,text/xml;q=0.9,*/*;q=0.8');
      if (!result) continue;
      const candidates = parseFeed(result.text).sort((a, b) => overlap(title, `${b.title} ${b.description}`) - overlap(title, `${a.title} ${a.description}`));
      for (const item of candidates) {
        const relevance = overlap(title, `${item.title} ${item.description}`);
        if (relevance < 2) continue;
        const url = normalize(item.url);
        const publisherFamily = family(url);
        if (!url || !publisherFamily || existingFamilies.has(publisherFamily) || seen.has(url)) continue;
        seen.add(url);
        const page = await validatePublisherPage(url, title);
        if (!page) continue;
        additions.push({ title: item.title || title, url: page.finalUrl, finalUrl: page.finalUrl, domain: host(page.finalUrl), publisherFamily, ok: true, status: 200, discovered: true, relevanceOverlap: relevance, recovery: true, resolvedFrom: 'news-feed-publisher-page', bodyChars: page.bodyChars });
        existingFamilies.add(publisherFamily);
        if (existingFamilies.size >= 2 || additions.length >= maxPerRecord) break;
      }
      if (existingFamilies.size >= 2 || additions.length >= maxPerRecord) break;
    }
    if (existingFamilies.size >= 2 || additions.length >= maxPerRecord) break;
  }

  if (existingFamilies.size < 2 && additions.length < maxPerRecord) {
    for (const query of queries) {
      const result = await get(`https://www.google.com/search?q=${encodeURIComponent(query)}&num=20`);
      if (!result) continue;
      for (const m of result.text.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
        const url = normalize(clean(m[1]));
        const text = clean(m[2]);
        const publisherFamily = family(url);
        if (!url || !publisherFamily || mirrors.has(host(url)) || blocked.has(host(url)) || homepage(url) || feed(url) || existingFamilies.has(publisherFamily) || seen.has(url) || overlap(title, text) < 2) continue;
        seen.add(url);
        const page = await validatePublisherPage(url, title);
        if (!page) continue;
        additions.push({ title, url: page.finalUrl, finalUrl: page.finalUrl, domain: host(page.finalUrl), publisherFamily, ok: true, status: 200, discovered: true, relevanceOverlap: overlap(title, text), recovery: true, resolvedFrom: 'google-web-publisher-page', bodyChars: page.bodyChars });
        existingFamilies.add(publisherFamily);
        if (existingFamilies.size >= 2 || additions.length >= maxPerRecord) break;
      }
      if (existingFamilies.size >= 2 || additions.length >= maxPerRecord) break;
    }
  }

  if (!additions.length) return { ...record, recovery: { attempted: true, added: 0, independentPublisherFamilies: [] } };
  const sources = [...current, ...additions];
  return { ...record, sources, sourceCount: sources.length, reachableSourceCount: sources.filter(s => s.ok).length, uniqueDomainCount: new Set(sources.map(s => host(s.finalUrl || s.url)).filter(Boolean)).size, independentReachableDomains: [...new Set(sources.map(s => host(s.finalUrl || s.url)).filter(Boolean))], recovery: { attempted: true, added: additions.length, independentPublisherFamilies: [...new Set(additions.map(s => s.publisherFamily))], methods: [...new Set(additions.map(s => s.resolvedFrom))] } };
}

async function mapWithConcurrency(items, limit) {
  const results = new Array(items.length); let next = 0;
  async function worker() { while (true) { const index = next++; if (index >= items.length) return; results[index] = await recover(items[index]); } }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

try {
  const report = JSON.parse(await fs.readFile(inputPath, 'utf8'));
  const records = Array.isArray(report.records) ? report.records : [];
  const recovered = await mapWithConcurrency(records, recoveryConcurrency);
  const attempted = recovered.filter(r => r.recovery?.attempted).length;
  const added = recovered.reduce((sum, r) => sum + Number(r.recovery?.added || 0), 0);
  await fs.writeFile(inputPath, `${JSON.stringify({ ...report, version: 10, recoveredAt: new Date().toISOString(), recoverySummary: { attempted, added }, records: recovered }, null, 2)}\n`);
  console.log(`Publisher recovery v5: ${attempted}/${records.length} attempted; ${added} validated publisher article URL(s) added.`);
} catch (error) {
  console.log(`Publisher recovery skipped: ${error instanceof Error ? error.message : String(error)}`);
}
