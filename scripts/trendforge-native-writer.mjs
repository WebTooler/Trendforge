import fs from 'node:fs';

const OUTPUT_VERSION = '2.2';
const MIN_EVIDENCE = 2;
const FETCH_TIMEOUT_MS = 7000;
const STOP = new Set('a an and are as at be been but by can could for from has have if in into is it its may more most no not of on or our said should so than that the their there these they this to was were what when where which who will with would you your technology tech digital latest news update updates guide how today artificial intelligence company companies industry development developments according reported'.split(' '));
const CRITICAL = new Set(['ai', 'btc', 'eth', 'xrp', 'uk', 'us', 'eu']);
const BOILERPLATE = /(newsletter|subscribe|sign up|opt in|in your inbox|follow us|advertisement|cookie|privacy policy|terms of use|podcast|listen now|read more|this is .*weekly|weekly newsletter)/i;
const PLACEHOLDER = /(^|\b)(source|unknown|n\/a|undefined|null)(\b|$)/i;

const clean = (value = '') => String(value)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&(?:amp;)?#8230;|&#x2026;|&hellip;/gi, '…')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
  .replace(/\\u003c/gi, '<').replace(/\\u003e/gi, '>').replace(/\\u0026/gi, '&')
  .replace(/\[[^\]]*…[^\]]*\]/g, ' ')
  .replace(/\s+/g, ' ').trim();

const words = (text = '') => clean(text).toLowerCase().split(/[^a-z0-9]+/).filter(w => (w.length > 3 && !STOP.has(w)) || CRITICAL.has(w));
const overlap = (a, b) => {
  const A = new Set(words(a)); const B = new Set(words(b));
  return [...A].filter(x => B.has(x)).length;
};
const sentenceSplit = (text = '') => clean(text).match(/[^.!?]+(?:[.!?]+|$)/g)?.map(s => s.trim()).filter(s => s.length >= 45 && s.length <= 420) ?? [];
const unique = (items) => [...new Map(items.filter(Boolean).map(x => [clean(x).toLowerCase(), clean(x)])).values()];

function publisher(item = {}) {
  const name = clean(item.sourceName || item.publisher || item.source || '');
  if (!name || PLACEHOLDER.test(name) || /^google news$/i.test(name)) return '';
  return name;
}

function domain(url = '') {
  try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; }
}

function absoluteUrl(href, baseUrl) {
  try { return new URL(href, baseUrl).toString(); } catch { return ''; }
}

function metaValue(html, attr, value) {
  const re = new RegExp(`<meta[^>]+${attr}=["']${value}["'][^>]+content=["']([\\s\\S]*?)["'][^>]*>`, 'i');
  const reverse = new RegExp(`<meta[^>]+content=["']([\\s\\S]*?)["'][^>]+${attr}=["']${value}["'][^>]*>`, 'i');
  return clean((html.match(re) || html.match(reverse) || [,''])[1]);
}

function extractJsonLd(html) {
  const records = [];
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\\s\\S]*?)<\/script>/gi)) {
    let raw = match[1].trim().replace(/^<!--|-->$/g, '');
    try {
      const parsed = JSON.parse(raw);
      const visit = (node) => {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) { node.forEach(visit); return; }
        records.push(node);
        for (const value of Object.values(node)) visit(value);
      };
      visit(parsed);
    } catch {
      const bodyMatches = [...raw.matchAll(/"articleBody"\s*:\s*"((?:\\.|[^"\\])*)"/gi)];
      for (const m of bodyMatches) {
        try { records.push({ articleBody: JSON.parse(`"${m[1]}"`) }); } catch { records.push({ articleBody: m[1] }); }
      }
    }
  }
  return records;
}

function jsonLdArticleBodies(records) {
  return records.flatMap(r => {
    if (typeof r?.articleBody === 'string') return [r.articleBody];
    return [];
  });
}

function jsonLdArticleMeta(records) {
  const out = [];
  for (const r of records) {
    if (!r || typeof r !== 'object') continue;
    const type = Array.isArray(r['@type']) ? r['@type'].join(' ') : String(r['@type'] || '');
    if (/article|newsarticle|report/i.test(type) || r.articleBody) {
      out.push({
        headline: clean(r.headline || r.name || ''),
        description: clean(r.description || ''),
        url: clean(typeof r.url === 'string' ? r.url : r.mainEntityOfPage?.['@id'] || r.mainEntityOfPage?.url || ''),
        type,
      });
    }
  }
  return out;
}

function extractLinkedArticleUrls(html, baseUrl, topic, preferredTitle = '') {
  const links = [];
  const add = (href, text = '') => {
    const url = absoluteUrl(href, baseUrl);
    const label = clean(text);
    if (!url || !/^https?:\/\//i.test(url) || !label || BOILERPLATE.test(label)) return;
    const score = Math.max(overlap(topic, label), overlap(preferredTitle, label));
    if (score >= 3) links.push({ url, text: label, score });
  };

  for (const match of html.matchAll(/<a\b([^>]*?)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi)) {
    add(match[2], match[4]);
  }

  for (const record of extractJsonLd(html)) {
    if (!record || typeof record !== 'object') continue;
    if (typeof record.url === 'string') add(record.url, record.name || record.headline || '');
    if (Array.isArray(record.itemListElement)) {
      for (const item of record.itemListElement) {
        if (typeof item === 'string') add(item, '');
        else add(item?.url || item?.item?.url || '', item?.name || item?.item?.name || item?.headline || '');
      }
    }
  }

  const seen = new Set();
  return links.filter(x => {
    const key = x.url.split('#')[0];
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).sort((a, b) => b.score - a.score).slice(0, 10);
}

async function fetchSource(url, topic = '', preferredTitle = '') {
  if (!/^https?:\/\//i.test(url || '')) return null;
  try {
    const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), headers: { 'user-agent': 'TrendForge-native-writer/2.2', accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/xml;q=0.8,*/*;q=0.5' } });
    if (!r.ok) return null;
    const html = await r.text();
    const finalUrl = r.url || url;
    const records = extractJsonLd(html);
    const articleMeta = jsonLdArticleMeta(records);
    const jsonHeadline = articleMeta.find(x => x.headline)?.headline || '';
    const title = clean((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [,''])[1]) || jsonHeadline;
    const description = metaValue(html, 'name', 'description') || metaValue(html, 'property', 'og:description') || articleMeta.find(x => x.description)?.description || '';
    const canonical = metaValue(html, 'property', 'og:url') || clean((html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i) || [,''])[1]);
    const articleBody = clean((html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i) || [,''])[1]);
    const jsonBodies = jsonLdArticleBodies(records);
    const paragraphs = unique([
      ...[...html.matchAll(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/gi)].map(m => clean(m[1])),
      ...[articleBody],
      ...jsonBodies,
    ]).filter(p => p.length >= 50 && p.length <= 1800 && !BOILERPLATE.test(p));
    const sentences = unique(paragraphs.flatMap(sentenceSplit)).filter(s => !BOILERPLATE.test(s));
    const links = extractLinkedArticleUrls(html, finalUrl, topic, preferredTitle);
    return { url, finalUrl, canonical, domain: domain(finalUrl), title, description, paragraphs, sentences, linkedArticles: links, articleBodyLength: jsonBodies.join(' ').length + articleBody.length };
  } catch { return null; }
}

function candidateSources(candidate) {
  const list = [];
  const add = (s, fallbackTitle = '') => {
    if (!s?.url || list.some(x => x.url === s.url)) return;
    const title = clean(s.title || fallbackTitle);
    const pub = publisher(s);
    list.push({ title, url: s.url, publisher: pub, description: clean(s.description || '') });
  };
  add({ title: candidate.title, url: candidate.link, sourceName: candidate.sourceName }, candidate.title);
  if (Array.isArray(candidate.sources)) for (const s of candidate.sources.slice(0, 8)) add(s, candidate.title);
  return list.slice(0, 10);
}

async function hydrateSources(candidate, sources) {
  const topic = `${candidate.title} ${candidate.description || ''}`;
  const hydrated = [];
  const seen = new Set();
  for (const source of sources) {
    if (seen.has(source.url)) continue;
    seen.add(source.url);
    const fetched = await fetchSource(source.url, topic, source.title);
    if (!fetched) continue;
    const sourceTitleOverlap = Math.max(overlap(topic, fetched.title), overlap(source.title, fetched.title));
    const hasArticleBody = fetched.articleBodyLength >= 700;
    const looksLikeArticle = (fetched.sentences.length >= 3 && sourceTitleOverlap >= 2) || (hasArticleBody && sourceTitleOverlap >= 2);
    if (looksLikeArticle && !/^news\.google\./i.test(fetched.domain)) {
      hydrated.push(fetched);
      continue;
    }

    const sourceDomain = fetched.domain;
    const linkedCandidates = (fetched.linkedArticles || []).filter(linked => domain(linked.url) === sourceDomain || /^news\.google\./i.test(sourceDomain));
    let followed = 0;
    for (const linked of linkedCandidates) {
      if (seen.has(linked.url)) continue;
      seen.add(linked.url);
      const linkedFetched = await fetchSource(linked.url, topic, source.title || linked.text);
      if (!linkedFetched) continue;
      const linkedOverlap = Math.max(overlap(topic, linked.text), overlap(source.title, linked.text), overlap(topic, linkedFetched.title), overlap(source.title, linkedFetched.title));
      if (linkedOverlap >= 3 && linkedFetched.sentences.length >= 3 && (!sourceDomain || domain(linkedFetched.finalUrl) === sourceDomain)) {
        hydrated.push({ ...linkedFetched, resolvedFromPublisherPage: true, sourcePage: source.url, sourceHintTitle: source.title });
        followed += 1;
        if (followed >= 2) break;
      }
    }
  }
  return hydrated;
}

function evidenceFor(fetched) {
  const evidence = [];
  for (const f of fetched) {
    if (!f) continue;
    if (f.title && !BOILERPLATE.test(f.title)) evidence.push({ text: f.title, source: f });
    if (f.description && !BOILERPLATE.test(f.description)) evidence.push({ text: f.description, source: f });
    for (const s of f.sentences.slice(0, 80)) evidence.push({ text: s, source: f });
  }
  return unique(evidence.map(e => e.text)).map(text => evidence.find(e => clean(e.text).toLowerCase() === text.toLowerCase()));
}

function chooseFacts(evidence, topic, limit = 18) {
  const topicWords = new Set(words(topic));
  const topicPhrases = clean(topic).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  return evidence.map((e, i) => {
    const textWords = new Set(words(e.text));
    const shared = [...topicWords].filter(x => textWords.has(x));
    const phraseBoost = topicPhrases.some(p => p.length >= 6 && clean(e.text).toLowerCase().includes(p)) ? 2 : 0;
    const relevance = shared.length + phraseBoost;
    const sourceDomain = e.source?.domain || '';
    return { ...e, relevance, shared, score: relevance * 8 + Math.min(e.text.length / 120, 4) - i * 0.01, sourceDomain };
  })
    .filter(e => e.relevance >= 2 && e.text.length >= 55 && e.text.length <= 420 && !BOILERPLATE.test(e.text))
    .sort((a,b) => b.score - a.score)
    .slice(0, limit);
}

function factSentence(f, lead = 'Reporting from the cited source indicates') {
  const text = clean(f.text).replace(/\s+/g, ' ');
  if (!text || PLACEHOLDER.test(text)) return '';
  return `${lead} that ${text.replace(/^[A-Z]/, c => c.toLowerCase()).replace(/[.!?]+$/, '')}.`;
}

function buildSections(category) {
  if (category === 'How-To') return [['What you need to know first','change'],['Step-by-step approach','steps'],['How to check the result','evidence'],['Common limitations and failure points','limits'],['What to do next','next']];
  if (category === 'Product Launches') return [['What launched','change'],['What is actually available','evidence'],['Who is likely to benefit','impact'],['Limits and availability caveats','limits'],['What to watch next','next']];
  if (category === 'Crypto') return [['What is happening','change'],['What the reporting confirms','evidence'],['Why market participants may care','impact'],['What is still uncertain','limits'],['What to watch next','next']];
  return [['What is changing','change'],['What the evidence shows','evidence'],['Why it matters','impact'],['What remains uncertain','limits'],['What readers should watch next','next']];
}

function makeParagraphs(facts, category) {
  const pool = facts.slice();
  const take = () => pool.shift();
  const sections = buildSections(category);
  const out = [];
  for (const [heading, kind] of sections) {
    const chosen = [take(), take()].filter(Boolean);
    if (!chosen.length) continue;
    let p = '';
    if (kind === 'change') p = `${factSentence(chosen[0], 'The strongest available source describes')} ${chosen[1] ? factSentence(chosen[1], 'The same source material also reports') : ''}`;
    else if (kind === 'evidence') p = `${factSentence(chosen[0], 'The cited reporting establishes')} ${chosen[1] ? factSentence(chosen[1], 'A separate passage from the cited reporting adds') : ''}`;
    else if (kind === 'impact') p = `${factSentence(chosen[0], 'For readers, the practical significance is reflected in the reported fact that')} ${chosen[1] ? factSentence(chosen[1], 'The source material also indicates') : ''}`;
    else if (kind === 'limits') p = `${factSentence(chosen[0], 'One limitation visible in the reporting is')} ${chosen[1] ? factSentence(chosen[1], 'Another reported detail is') : ''} These points should not be extended into claims that the sources do not establish.`;
    else if (kind === 'steps') p = `${factSentence(chosen[0], 'The supplied reporting establishes')} ${chosen[1] ? factSentence(chosen[1], 'It also reports') : ''}`;
    else p = `${factSentence(chosen[0], 'The current reporting says')} ${chosen[1] ? factSentence(chosen[1], 'Another relevant detail is') : ''} Until new evidence appears, stronger conclusions would go beyond the material available to this fallback writer.`;
    out.push({ heading, paragraph: clean(p) });
  }
  return out;
}

function qualityText(text) {
  const sentences = sentenceSplit(text);
  const normalized = sentences.map(s => s.toLowerCase().replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ').trim());
  const seen = new Set(); let duplicates = 0;
  for (const s of normalized) { if (seen.has(s)) duplicates++; seen.add(s); }
  const generic = /(in today's fast|it is important to note|in conclusion|game changer|revolutionary era)/gi;
  const artifacts = /(\[?&#\d+;|&amp;#|\bSource\b,?\s+(reports|says|indicates)|\bUnknown\b)/gi;
  return { words: clean(text).split(/\s+/).filter(Boolean).length, sentences: sentences.length, duplicates, genericHits: (text.match(generic)||[]).length, artifactHits: (text.match(artifacts)||[]).length };
}

export async function generateNativeArticle({ candidate, existingTitles = new Set() }) {
  if (!candidate?.title || !candidate?.category) return { ok:false, reason:'missing candidate' };
  const sources = candidateSources(candidate);
  if (sources.length < MIN_EVIDENCE) return { ok:false, reason:'candidate has fewer than 2 source inputs; no cross-candidate source mixing allowed' };
  const fetched = await hydrateSources(candidate, sources);
  const usable = fetched.filter(x => x.sentences.length || x.description || x.title);
  const independentDomains = new Set(usable.map(x => x.domain).filter(Boolean));
  if (independentDomains.size < MIN_EVIDENCE) return { ok:false, reason:`native writer needs ${MIN_EVIDENCE} independent reachable sources for this candidate; found ${independentDomains.size}` };

  const topic = `${candidate.title} ${candidate.description || ''}`;
  const evidence = chooseFacts(evidenceFor(usable), topic, 18);
  if (evidence.length < 10) return { ok:false, reason:`insufficient topic-relevant source evidence; found ${evidence.length} relevant evidence items` };
  const relevantDomains = new Set(evidence.map(e => e.sourceDomain).filter(Boolean));
  if (relevantDomains.size < MIN_EVIDENCE) return { ok:false, reason:`topic-relevant evidence comes from only ${relevantDomains.size} independent domain(s)` };

  const title = clean(candidate.title.replace(/\s+-\s+[^-]+$/, '').trim());
  const duplicateTitle = [...existingTitles].some(t => clean(t).toLowerCase() === title.toLowerCase());
  if (duplicateTitle) return { ok:false, reason:'duplicate title' };
  const introFacts = evidence.slice(0, 2);
  const sections = makeParagraphs(evidence.slice(2), candidate.category);
  const content = [
    `The story is worth following because the cited reporting points to a concrete development. This provider-independent briefing uses only evidence tied to the selected story and separates reported information from interpretation.`,
    introFacts.map(f => factSentence(f, 'The available reporting indicates')).filter(Boolean).join(' '),
    ...sections.flatMap(s => [`## ${s.heading}`, s.paragraph]),
  ].join('\n\n');

  const metrics = qualityText(content);
  if (metrics.words < 700) return { ok:false, reason:`native article evidence produced only ${metrics.words} words; refusing to pad` };
  if (metrics.genericHits > 1 || metrics.duplicates > 0 || metrics.artifactHits > 0) return { ok:false, reason:'native quality checks failed: repetition, boilerplate/template artifact, or generic filler detected' };
  const sectionBodies = sections.map(s => s.paragraph);
  if (new Set(sectionBodies.map(s => clean(s).toLowerCase())).size !== sectionBodies.length) return { ok:false, reason:'cross-section duplication detected' };

  const description = `A source-backed TrendForge briefing on ${title.toLowerCase()}, using only evidence tied to the selected story and clearly marking what remains uncertain.`;
  return {
    ok:true,
    article:{ title, description, content, category:candidate.category, sources: usable.map(s => ({ title:s.title || s.domain || 'Cited source', url:s.finalUrl || s.canonical || s.url })).slice(0,4), sourceTexts: usable.map(s => [...(s.title ? [s.title] : []), ...(s.description ? [s.description] : []), ...s.sentences].join(' ')) },
    diagnostics:{ version:OUTPUT_VERSION, evidenceItems:evidence.length, relevantEvidenceItems:evidence.length, reachableSources:usable.length, independentDomains:[...independentDomains], relevantDomains:[...relevantDomains], hydratedArticlePages:usable.filter(s => s.resolvedFromPublisherPage).length, structuredArticleBodies:usable.filter(s => s.articleBodyLength >= 700).length, sourceIsolation:true, relatedCandidateMixing:false, ...metrics }
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const input = 'data/scored-trends.json';
  if (!fs.existsSync(input)) process.exit(0);
  const payload = JSON.parse(fs.readFileSync(input, 'utf8'));
  const candidate = (payload.trends || []).find(x => x.eligible);
  const result = await generateNativeArticle({ candidate, existingTitles:new Set() });
  console.log(JSON.stringify(result, null, 2));
}
