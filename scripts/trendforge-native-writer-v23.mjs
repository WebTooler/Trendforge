import fs from 'node:fs';

const OUTPUT_VERSION = '2.3';
const MIN_DOMAINS = 2;
const MIN_EVIDENCE = 10;
const MIN_WORDS = 450;
const FETCH_TIMEOUT_MS = 7000;
const MAX_LINKS = 10;
const MAX_FOLLOWED_ARTICLES = 3;
const STOP = new Set('a an and are as at be been but by can could for from has have if in into is it its may more most no not of on or our said should so than that the their there these they this to was were what when where which who will with would you your technology tech digital latest news update updates guide how today artificial intelligence company companies industry development developments according reported'.split(' '));
const CRITICAL = new Set(['ai', 'btc', 'eth', 'xrp', 'uk', 'us', 'eu']);
const BOILERPLATE = /(newsletter|subscribe|sign up|opt in|in your inbox|follow us|advertisement|cookie|privacy policy|terms of use|podcast|listen now|read more|this is .*weekly|weekly newsletter)/i;
const PLACEHOLDER = /(^|\b)(source|unknown|n\/a|undefined|null)(\b|$)/i;

const clean = (value = '') => String(value)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&(?:amp;)?#8230;|&#x2026;|&hellip;/gi, '…')
  .replace(/&(?:amp;)?#8217;|&#x2019;/gi, "'")
  .replace(/&(?:amp;)?#8216;|&#x2018;/gi, "'")
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
  .replace(/\\u003c/gi, '<').replace(/\\u003e/gi, '>').replace(/\\u0026/gi, '&')
  .replace(/\[[^\]]*…[^\]]*\]/g, ' ')
  .replace(/\s+/g, ' ').trim();

const words = (text = '') => clean(text).toLowerCase().split(/[^a-z0-9]+/).filter(word => (word.length > 3 && !STOP.has(word)) || CRITICAL.has(word));
const overlap = (a, b) => {
  const A = new Set(words(a));
  const B = new Set(words(b));
  return [...A].filter(word => B.has(word)).length;
};
const sentenceSplit = (text = '') => clean(text).match(/[^.!?]+(?:[.!?]+|$)/g)?.map(s => s.trim()).filter(s => s.length >= 45 && s.length <= 420) ?? [];
const unique = items => [...new Map(items.filter(Boolean).map(item => [clean(item).toLowerCase(), clean(item)])).values()];
const domain = url => { try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } };
const absoluteUrl = (href, baseUrl) => { try { return new URL(href, baseUrl).toString(); } catch { return ''; } };

function metaValue(html, attr, value) {
  const re = new RegExp(`<meta[^>]+${attr}=["']${value}["'][^>]+content=["']([\\s\\S]*?)["'][^>]*>`, 'i');
  const reverse = new RegExp(`<meta[^>]+content=["']([\\s\\S]*?)["'][^>]+${attr}=["']${value}["'][^>]*>`, 'i');
  return clean((html.match(re) || html.match(reverse) || ['', ''])[1]);
}

function extractJsonLd(html) {
  const records = [];
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\\s\\S]*?)<\/script>/gi)) {
    const raw = match[1].trim().replace(/^<!--|-->$/g, '');
    try {
      const parsed = JSON.parse(raw);
      const visit = node => {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) { node.forEach(visit); return; }
        records.push(node);
        Object.values(node).forEach(visit);
      };
      visit(parsed);
    } catch {
      for (const matchBody of raw.matchAll(/"articleBody"\s*:\s*"((?:\\.|[^"\\])*)"/gi)) {
        try { records.push({ articleBody: JSON.parse(`"${matchBody[1]}"`) }); } catch { records.push({ articleBody: matchBody[1] }); }
      }
    }
  }
  return records;
}

function jsonLdArticleBodies(records) {
  return records.flatMap(record => typeof record?.articleBody === 'string' ? [record.articleBody] : []);
}

function jsonLdArticleMeta(records) {
  return records.flatMap(record => {
    if (!record || typeof record !== 'object') return [];
    const type = Array.isArray(record['@type']) ? record['@type'].join(' ') : String(record['@type'] || '');
    if (!/article|newsarticle|report/i.test(type) && !record.articleBody) return [];
    return [{
      headline: clean(record.headline || record.name || ''),
      description: clean(record.description || ''),
      url: clean(typeof record.url === 'string' ? record.url : record.mainEntityOfPage?.['@id'] || record.mainEntityOfPage?.url || ''),
      type,
    }];
  });
}

function extractLinkedArticleUrls(html, baseUrl, topic, preferredTitle = '') {
  const links = [];
  const add = (href, text = '') => {
    const url = absoluteUrl(href, baseUrl);
    const label = clean(text);
    if (!url || !/^https?:\/\//i.test(url) || !label || BOILERPLATE.test(label)) return;
    if (/^(news\.)?google\./i.test(domain(url))) return;
    const score = Math.max(overlap(topic, label), overlap(preferredTitle, label));
    if (score >= 3) links.push({ url, text: label, score });
  };

  for (const match of html.matchAll(/<a\b([^>]*?)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi)) add(match[2], match[4]);

  for (const match of html.matchAll(/<(?:item|entry)\b[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi)) {
    const item = match[1];
    const title = clean((item.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || ['', ''])[1]);
    const description = clean((item.match(/<description[^>]*>([\s\S]*?)<\/description>/i) || ['', ''])[1]);
    const direct = clean((item.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || ['', ''])[1]);
    const href = clean((item.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i) || ['', ''])[1]);
    add(direct || href, `${title} ${description}`);
  }

  for (const record of extractJsonLd(html)) {
    if (typeof record?.url === 'string') add(record.url, record.name || record.headline || '');
    if (Array.isArray(record?.itemListElement)) {
      for (const item of record.itemListElement) {
        const url = typeof item === 'string' ? item : item?.url || item?.item?.url || '';
        const label = typeof item === 'string' ? '' : item?.name || item?.item?.name || item?.headline || '';
        add(url, label);
      }
    }
  }

  const seen = new Set();
  return links.filter(link => {
    const key = link.url.split('#')[0];
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => b.score - a.score).slice(0, MAX_LINKS);
}

function extractContentContainers(html) {
  const chunks = [];
  const patterns = [
    /<article\b[^>]*>([\s\S]*?)<\/article>/gi,
    /<main\b[^>]*>([\s\S]*?)<\/main>/gi,
    /<(?:div|section)\b[^>]*(?:class|id)=["'][^"']*(?:article|story|post|entry|content|body)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|section)>/gi,
  ];
  for (const pattern of patterns) for (const match of html.matchAll(pattern)) chunks.push(match[1]);
  return chunks;
}

async function fetchSource(url, topic = '', preferredTitle = '') {
  if (!/^https?:\/\//i.test(url || '')) return null;
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        'user-agent': 'TrendForge-native-writer/2.3',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,application/rss+xml;q=0.8,application/atom+xml;q=0.8,text/xml;q=0.8,*/*;q=0.5',
      },
    });
    if (!response.ok) return null;
    const html = await response.text();
    const finalUrl = response.url || url;
    const records = extractJsonLd(html);
    const articleMeta = jsonLdArticleMeta(records);
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = clean(titleMatch?.[1] || articleMeta.find(item => item.headline)?.headline || '');
    const description = metaValue(html, 'name', 'description') || metaValue(html, 'property', 'og:description') || articleMeta.find(item => item.description)?.description || '';
    const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i);
    const canonical = metaValue(html, 'property', 'og:url') || clean(canonicalMatch?.[1] || '');
    const articleMatch = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
    const articleBody = clean(articleMatch?.[1] || '');
    const jsonBodies = jsonLdArticleBodies(records);
    const containers = extractContentContainers(html);
    const rawParagraphs = [
      ...[...html.matchAll(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/gi)].map(match => clean(match[1])),
      ...containers.flatMap(container => [...container.matchAll(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/gi)].map(match => clean(match[1]))),
      articleBody,
      ...jsonBodies,
    ];
    const paragraphs = unique(rawParagraphs).filter(text => text.length >= 50 && text.length <= 1800 && !BOILERPLATE.test(text));
    const sentences = unique(paragraphs.flatMap(sentenceSplit)).filter(sentence => !BOILERPLATE.test(sentence));
    const linkedArticles = extractLinkedArticleUrls(html, finalUrl, topic, preferredTitle);
    return {
      url,
      finalUrl,
      canonical,
      domain: domain(finalUrl),
      title,
      description,
      paragraphs,
      sentences,
      linkedArticles,
      articleBodyLength: jsonBodies.join(' ').length + articleBody.length,
    };
  } catch {
    return null;
  }
}

function candidateSources(candidate) {
  const list = [];
  const add = (source, fallbackTitle = '') => {
    if (!source?.url || list.some(item => item.url === source.url)) return;
    list.push({
      title: clean(source.title || fallbackTitle),
      url: source.url,
      publisher: clean(source.sourceName || source.publisher || ''),
      description: clean(source.description || ''),
    });
  };
  add({ title: candidate.title, url: candidate.link, sourceName: candidate.sourceName }, candidate.title);
  if (Array.isArray(candidate.sources)) for (const source of candidate.sources.slice(0, 10)) add(source, candidate.title);
  return list.slice(0, 12);
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
    const articleLike = (fetched.sentences.length >= 3 && sourceTitleOverlap >= 2) || (fetched.articleBodyLength >= 700 && sourceTitleOverlap >= 2);
    if (articleLike && fetched.domain && !/^news\.google\./i.test(fetched.domain)) {
      hydrated.push(fetched);
      continue;
    }
    let followed = 0;
    for (const linked of fetched.linkedArticles || []) {
      if (seen.has(linked.url)) continue;
      const linkedDomain = domain(linked.url);
      if (!linkedDomain || (fetched.domain && linkedDomain !== fetched.domain)) continue;
      seen.add(linked.url);
      const linkedFetched = await fetchSource(linked.url, topic, linked.text || source.title);
      if (!linkedFetched) continue;
      const linkedOverlap = Math.max(overlap(topic, linked.text), overlap(source.title, linked.text), overlap(topic, linkedFetched.title), overlap(source.title, linkedFetched.title));
      if (linkedOverlap >= 3 && linkedFetched.sentences.length >= 3) {
        hydrated.push({ ...linkedFetched, resolvedFromPublisherPage: true, sourcePage: source.url, sourceHintTitle: source.title });
        followed += 1;
        if (followed >= MAX_FOLLOWED_ARTICLES) break;
      }
    }
  }
  return hydrated;
}

function evidenceFor(fetched) {
  const evidence = [];
  for (const source of fetched) {
    if (!source) continue;
    if (source.title && !BOILERPLATE.test(source.title)) evidence.push({ text: source.title, source });
    if (source.description && !BOILERPLATE.test(source.description)) evidence.push({ text: source.description, source });
    for (const sentence of source.sentences.slice(0, 100)) evidence.push({ text: sentence, source });
  }
  return unique(evidence.map(item => item.text)).map(text => evidence.find(item => clean(item.text).toLowerCase() === text.toLowerCase()));
}

function chooseFacts(evidence, topic, limit = 24) {
  const topicWords = new Set(words(topic));
  return evidence.map((item, index) => {
    const textWords = new Set(words(item.text));
    const shared = [...topicWords].filter(word => textWords.has(word));
    const phraseBoost = words(topic).some(token => token.length >= 6 && clean(item.text).toLowerCase().includes(token)) ? 2 : 0;
    const relevance = shared.length + phraseBoost;
    return { ...item, relevance, score: relevance * 8 + Math.min(item.text.length / 120, 4) - index * 0.01, sourceDomain: item.source?.domain || '' };
  }).filter(item => item.relevance >= 2 && item.text.length >= 55 && item.text.length <= 420 && !BOILERPLATE.test(item.text))
    .sort((a, b) => b.score - a.score).slice(0, limit);
}

function factSentence(fact, lead) {
  const text = clean(fact.text).replace(/\s+/g, ' ');
  if (!text || PLACEHOLDER.test(text)) return '';
  return `${lead}: ${text.replace(/[.!?]+$/, '')}.`;
}

function buildSections(category) {
  if (category === 'How-To') return [['What you need to know first', 'The reporting establishes'], ['Step-by-step approach', 'The available evidence shows'], ['How to check the result', 'A second evidence point adds'], ['Common limitations and failure points', 'One documented limitation is'], ['What to do next', 'The current evidence suggests']];
  if (category === 'Product Launches') return [['What launched', 'The reporting establishes'], ['What is actually available', 'The available evidence shows'], ['Who is likely to benefit', 'A second evidence point adds'], ['Limits and availability caveats', 'One documented limitation is'], ['What to watch next', 'The current evidence suggests']];
  if (category === 'Crypto') return [['What is happening', 'The reporting establishes'], ['What the reporting confirms', 'The available evidence shows'], ['Why market participants may care', 'A second evidence point adds'], ['What is still uncertain', 'One documented limitation is'], ['What to watch next', 'The current evidence suggests']];
  return [['What is changing', 'The reporting establishes'], ['What the evidence shows', 'The available evidence shows'], ['Why it matters', 'A second evidence point adds'], ['What remains uncertain', 'One documented limitation is'], ['What readers should watch next', 'The current evidence suggests']];
}

function makeSections(facts, category) {
  const sections = buildSections(category);
  const pool = facts.slice();
  const built = sections.map(([heading, lead]) => ({
    heading,
    lead,
    facts: [pool.shift(), pool.shift()].filter(Boolean),
  }));

  const renderWords = () => built.reduce((total, section) => total + words(section.facts.map(fact => factSentence(fact, section.lead)).join(' ')).length, 0);
  let cursor = 0;
  const targetSectionWords = MIN_WORDS - 60;

  while (pool.length && renderWords() < targetSectionWords) {
    const section = built[cursor % built.length];
    const next = pool.shift();
    if (next) section.facts.push(next);
    cursor += 1;
  }

  return built
    .filter(section => section.facts.length)
    .map(section => ({
      heading: section.heading,
      paragraph: section.facts.map(fact => factSentence(fact, section.lead)).filter(Boolean).join(' '),
    }))
    .filter(section => section.paragraph);
}

function qualityAudit(content, title, candidateTitle, sourceTexts) {
  const sentenceCount = sentenceSplit(content).length;
  const wordCount = clean(content).split(/\s+/).filter(Boolean).length;
  const h2Count = (content.match(/^##\s+.+$/gm) || []).length;
  const paragraphs = content.split(/\n\s*\n/).map(block => block.replace(/^##\s+.+\n?/, '').trim()).filter(Boolean);
  const normalized = paragraphs.map(text => clean(text).toLowerCase()).filter(text => text.length >= 80);
  const duplicateParagraphs = normalized.filter((text, index) => normalized.indexOf(text) !== index).length;
  const evidenceBacked = paragraphs.filter(paragraph => sourceTexts.some(source => overlap(paragraph, source) >= 2)).length;
  const unrelated = paragraphs.filter(paragraph => overlap(paragraph, candidateTitle) === 0 && Math.max(...sourceTexts.map(source => overlap(paragraph, source)), 0) < 2).length;
  const artifactHits = (content.match(/&amp;#|&#\d+;|\bSource\b,?\s+(reports|says|indicates)|\bUnknown\b|\bundefined\b/gi) || []).length;
  const passed = wordCount >= MIN_WORDS && h2Count >= 5 && sentenceCount >= 10 && paragraphs.length >= 6 && overlap(title, candidateTitle) >= 2 && evidenceBacked >= 5 && unrelated === 0 && duplicateParagraphs === 0 && artifactHits === 0;
  return { passed, wordCount, sentenceCount, h2Count, paragraphCount: paragraphs.length, evidenceBackedParagraphs: evidenceBacked, unrelatedParagraphs: unrelated, duplicateParagraphs, artifactHits };
}

export async function generateNativeArticle({ candidate, existingTitles = new Set() }) {
  if (!candidate?.title || !candidate?.category) return { ok: false, reason: 'missing candidate' };
  const sources = candidateSources(candidate);
  if (sources.length < MIN_DOMAINS) return { ok: false, reason: 'candidate has fewer than 2 source inputs; no cross-candidate source mixing allowed' };
  const fetched = await hydrateSources(candidate, sources);
  const usable = fetched.filter(source => source.sentences.length || source.description || source.title);
  const independentDomains = new Set(usable.map(source => source.domain).filter(Boolean));
  if (independentDomains.size < MIN_DOMAINS) return { ok: false, reason: `native writer needs ${MIN_DOMAINS} independent reachable sources for this candidate; found ${independentDomains.size}` };
  const topic = `${candidate.title} ${candidate.description || ''}`;
  const evidence = chooseFacts(evidenceFor(usable), topic, 24);
  if (evidence.length < MIN_EVIDENCE) return { ok: false, reason: `insufficient topic-relevant source evidence; found ${evidence.length} relevant evidence items` };
  const relevantDomains = new Set(evidence.map(item => item.sourceDomain).filter(Boolean));
  if (relevantDomains.size < MIN_DOMAINS) return { ok: false, reason: `topic-relevant evidence comes from only ${relevantDomains.size} independent domain(s)` };

  const title = clean(candidate.title.replace(/\s+-\s+[^-]+$/, '').trim());
  if ([...existingTitles].some(existing => clean(existing).toLowerCase() === title.toLowerCase())) return { ok: false, reason: 'duplicate title' };

  const introFacts = evidence.slice(0, 2);
  const sections = makeSections(evidence.slice(2), candidate.category);
  const sourceTexts = usable.map(source => [...(source.title ? [source.title] : []), ...(source.description ? [source.description] : []), ...source.sentences].join(' '));
  const content = [
    `The story is worth following because the cited reporting points to a concrete development. This provider-independent briefing uses only evidence tied to the selected story and does not extend beyond what the sources establish.`,
    introFacts.map(fact => factSentence(fact, 'The available reporting indicates')).filter(Boolean).join(' '),
    ...sections.flatMap(section => [`## ${section.heading}`, section.paragraph]),
  ].join('\n\n');

  const audit = qualityAudit(content, title, candidate.title, sourceTexts);
  if (!audit.passed) return { ok: false, reason: `native article evidence did not meet the source-limited quality floor (${audit.wordCount} words, ${audit.evidenceBackedParagraphs} evidence-backed paragraphs)` };

  return {
    ok: true,
    article: {
      title,
      description: `A source-backed TrendForge briefing on ${title.toLowerCase()}, using only evidence tied to the selected story and clearly marking what remains uncertain.`,
      content,
      category: candidate.category,
      sources: usable.map(source => ({ title: source.title || source.domain || 'Cited source', url: source.finalUrl || source.canonical || source.url })).slice(0, 4),
      sourceTexts,
    },
    diagnostics: {
      version: OUTPUT_VERSION,
      minimumWords: MIN_WORDS,
      evidenceItems: evidence.length,
      relevantEvidenceItems: evidence.length,
      reachableSources: usable.length,
      independentDomains: [...independentDomains],
      relevantDomains: [...relevantDomains],
      hydratedArticlePages: usable.filter(source => source.resolvedFromPublisherPage).length,
      structuredArticleBodies: usable.filter(source => source.articleBodyLength >= 700).length,
      feedArticleLinksRecovered: usable.filter(source => (source.linkedArticles || []).length > 0).length,
      sourceIsolation: true,
      relatedCandidateMixing: false,
      ...audit,
    },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const input = 'data/scored-trends.json';
  if (!fs.existsSync(input)) process.exit(0);
  const payload = JSON.parse(fs.readFileSync(input, 'utf8'));
  const candidate = (payload.trends || []).find(item => item.eligible);
  const result = await generateNativeArticle({ candidate, existingTitles: new Set() });
  console.log(JSON.stringify(result, null, 2));
}
