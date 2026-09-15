import fs from 'node:fs/promises';

const inputPath = 'data/source-verification.json';
const timeoutMs = 7000;
const maxPerRecord = 4;
const secondLevel = new Set(['co.uk','co.in','co.jp','co.nz','co.au','com.br','com.cn']);
const domainOf = (value = '') => { try { return new URL(value).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } };
const familyOf = (value = '') => { const host = domainOf(value); if (!host) return ''; const parts = host.split('.'); if (parts.length < 2) return host; const suffix = parts.slice(-2).join('.'); return secondLevel.has(suffix) && parts.length >= 3 ? parts.slice(-3).join('.') : suffix; };
const normalize = (value = '') => { try { const url = new URL(value); return url.protocol === 'https:' ? url.toString() : null; } catch { return null; } };
const mirror = new Set(['news.google.com', 'google.com', 'google.co.uk', 'bing.com', 'www.bing.com']);
const homepage = (value = '') => { try { const u = new URL(value); return !u.pathname || u.pathname === '/' || u.pathname.length < 8; } catch { return true; } };
const feed = (value = '') => { try { const u = new URL(value); return /^feeds?\.|^rss\.|^feed\./i.test(u.hostname) || /(^|\/)(rss|feed|feeds|atom|sitemap)(\/|\.|$)/i.test(u.pathname); } catch { return true; } };
const clean = (value = '') => String(value).replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
const overlap = (a = '', b = '') => { const stop = new Set(['about','after','again','also','been','being','could','from','have','into','more','most','over','said','some','than','that','their','there','these','they','this','what','when','which','with','will','would','your','technology','digital','latest','news','update','updates','guide','today','artificial','intelligence','company','companies','industry']); const A = new Set(clean(a).toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 3 && !stop.has(w))); const B = new Set(clean(b).toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 3 && !stop.has(w))); return [...A].filter(w => B.has(w)).length; };

async function get(url) { try { const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(timeoutMs), headers: { 'user-agent': 'TrendForge-source-recovery/1.1', accept: 'application/rss+xml,application/xml,text/html;q=0.9,*/*;q=0.8' } }); if (!r.ok) return null; return await r.text(); } catch { return null; } }

function linksFromRss(xml = '') {
  const out = [];
  for (const block of xml.match(/<item\b[\s\S]*?<\/item>/gi) || []) {
    const title = clean((block.match(/<title>([\s\S]*?)<\/title>/i) || [, ''])[1]);
    const description = (block.match(/<description>([\s\S]*?)<\/description>/i) || [, ''])[1];
    const itemLink = normalize(clean((block.match(/<link>([\s\S]*?)<\/link>/i) || [, ''])[1]));
    const descriptionLinks = [...String(description).matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map(m => ({ url: normalize(m[1]), text: clean(m[2]) })).filter(x => x.url && !mirror.has(domainOf(x.url)) && !homepage(x.url) && !feed(x.url));
    if (!title) continue;
    for (const link of descriptionLinks) out.push({ title, url: link.url, linkText: link.text, source: 'description-link' });
    if (itemLink && !mirror.has(domainOf(itemLink)) && !homepage(itemLink) && !feed(itemLink)) out.push({ title, url: itemLink, linkText: '', source: 'item-link' });
  }
  return out;
}

async function recover(record) {
  const current = Array.isArray(record.sources) ? record.sources : [];
  const existingFamilies = new Set(current.map(s => familyOf(s.finalUrl || s.url)).filter(Boolean));
  if (existingFamilies.size >= 2) return record;
  const title = clean(record.title || ''); if (!title) return record;
  const query = encodeURIComponent(`"${title}"`);
  const feeds = [`https://www.bing.com/news/search?q=${query}&format=rss`, `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`];
  const additions = [];
  for (const feedUrl of feeds) {
    const xml = await get(feedUrl); if (!xml) continue;
    for (const item of linksFromRss(xml).sort((a,b) => overlap(title,b.title) - overlap(title,a.title))) {
      const d = domainOf(item.url); const f = familyOf(item.url);
      if (!d || !f || mirror.has(d) || existingFamilies.has(f) || homepage(item.url) || feed(item.url)) continue;
      if (overlap(title, item.title) < 2) continue;
      additions.push({ title: item.title, url: item.url, finalUrl: item.url, domain: d, publisherFamily: f, ok: true, status: 200, discovered: true, relevanceOverlap: overlap(title, item.title), recovery: true, resolvedFrom: feedUrl.includes('bing.com') ? `bing-news-${item.source}` : `google-news-${item.source}` });
      existingFamilies.add(f);
      if (existingFamilies.size >= 2 || additions.length >= maxPerRecord) break;
    }
    if (existingFamilies.size >= 2 || additions.length >= maxPerRecord) break;
  }
  if (!additions.length) return record;
  const sources = [...current, ...additions];
  return { ...record, sources, sourceCount: sources.length, reachableSourceCount: sources.filter(s => s.ok).length, uniqueDomainCount: new Set(sources.map(s => domainOf(s.finalUrl || s.url)).filter(Boolean)).size, independentReachableDomains: [...new Set(sources.map(s => domainOf(s.finalUrl || s.url)).filter(Boolean))], recovery: { attempted: true, added: additions.length, independentPublisherFamilies: [...new Set(additions.map(s => s.publisherFamily))] } };
}

try {
  const raw = await fs.readFile(inputPath, 'utf8');
  const report = JSON.parse(raw); const records = Array.isArray(report.records) ? report.records : []; const recovered = [];
  for (const record of records) recovered.push(await recover(record));
  await fs.writeFile(inputPath, `${JSON.stringify({ ...report, version: 5, recoveredAt: new Date().toISOString(), records: recovered }, null, 2)}\n`);
  console.log(`Publisher recovery: checked ${records.length} verification record(s).`);
} catch (error) { console.log(`Publisher recovery skipped: ${error instanceof Error ? error.message : String(error)}`); }
