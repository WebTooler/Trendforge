import fs from 'node:fs';

const OUTPUT_VERSION = '1.1';
const MIN_EVIDENCE = 2;
const FETCH_TIMEOUT_MS = 7000;
const MAX_RELATED = 5;
const STOP = new Set('a an and are as at be been but by can could for from has have if in into is it its may more most no not of on or our said should so than that the their there these they this to was were what when where which who will with would you your'.split(' '));

const clean = (value = '') => String(value)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
  .replace(/\s+/g, ' ').trim();

const words = (text = '') => clean(text).toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 3 && !STOP.has(w));
const overlap = (a, b) => {
  const A = new Set(words(a)); const B = new Set(words(b));
  return [...A].filter(x => B.has(x)).length;
};
const sentenceSplit = (text = '') => clean(text).match(/[^.!?]+(?:[.!?]+|$)/g)?.map(s => s.trim()).filter(s => s.length >= 45 && s.length <= 420) ?? [];
const unique = (items) => [...new Map(items.filter(Boolean).map(x => [clean(x).toLowerCase(), clean(x)])).values()];
const esc = (s = '') => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, ' ');

function publisher(item = {}) {
  if (item.sourceName && item.sourceName.toLowerCase() !== 'google news') return clean(item.sourceName);
  const m = clean(item.description || '').match(/(?:^|\s)([A-Za-z0-9][A-Za-z0-9 .&'-]{1,60})$/);
  return m?.[1]?.trim() || clean(item.source || 'Source');
}

function domain(url = '') {
  try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; }
}

async function fetchSource(url) {
  if (!/^https?:\/\//i.test(url || '')) return null;
  try {
    const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), headers: { 'user-agent': 'TrendForge-native-writer/1.1' } });
    if (!r.ok) return null;
    const html = await r.text();
    const title = clean((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [,''])[1]);
    const description = clean((html.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([\s\S]*?)["']/i) || [,''])[1]);
    const paragraphs = unique([...html.matchAll(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/gi)].map(m => clean(m[1]))).filter(p => p.length >= 50 && p.length <= 1800);
    return { url, finalUrl: r.url || url, domain: domain(r.url || url), title, description, paragraphs, sentences: unique(paragraphs.flatMap(sentenceSplit)) };
  } catch { return null; }
}

function candidateSources(candidate, related) {
  const list = [];
  for (const item of [candidate, related]) {
    if (!item) continue;
    const url = item.link || item.sourceUrl;
    if (url && !list.some(x => x.url === url)) list.push({ title: clean(item.title), url, publisher: publisher(item), description: clean(item.description) });
    if (Array.isArray(item.sources)) for (const s of item.sources.slice(0, 8)) if (s?.url && !list.some(x => x.url === s.url)) list.push({ title: clean(s.title || item.title), url: s.url, publisher: publisher({ ...item, sourceName: s.sourceName }), description: clean(s.description || item.description) });
  }
  return list.slice(0, 10);
}

function relatedCandidate(candidate, trends) {
  const same = (trends || []).filter(x => x && x.link !== candidate.link && x.category === candidate.category);
  const cp = `${candidate.title} ${candidate.description || ''}`;
  const matches = same.map(x => ({ x, score: overlap(cp, `${x.title} ${x.description || ''}`) + (x.score || 0) / 100 }))
    .sort((a,b) => b.score - a.score).slice(0, MAX_RELATED).map(({ x }) => x);
  if (!matches.length) return null;
  const sources = matches.flatMap(x => Array.isArray(x.sources) ? x.sources : []).filter(s => s?.url);
  return {
    title: matches[0].title,
    description: matches.map(x => x.description).filter(Boolean).join(' '),
    sources,
  };
}

function evidenceFor(candidate, related, fetched) {
  const evidence = [];
  for (const f of fetched) {
    if (!f) continue;
    if (f.title) evidence.push({ text: f.title, source: f });
    if (f.description) evidence.push({ text: f.description, source: f });
    for (const s of f.sentences.slice(0, 18)) evidence.push({ text: s, source: f });
  }
  for (const item of [candidate, related]) if (item?.description) evidence.push({ text: clean(item.description), source: { title: item.title, domain: publisher(item) } });
  return unique(evidence.map(e => e.text)).map(text => evidence.find(e => clean(e.text).toLowerCase() === text.toLowerCase()));
}

function chooseFacts(evidence, topic, limit = 16) {
  return evidence.map((e, i) => ({ ...e, score: overlap(e.text, topic) * 4 + Math.min(e.text.length / 120, 5) - i * 0.03 }))
    .filter(e => e.text.length >= 55).sort((a,b) => b.score - a.score).slice(0, limit);
}

function factSentence(f, lead = 'Reporting from the cited source indicates') {
  const text = clean(f.text).replace(/\s+/g, ' ');
  if (!text) return '';
  return `${lead} that ${text.replace(/^[A-Z]/, c => c.toLowerCase()).replace(/[.!?]+$/, '')}.`;
}

function buildSections(category) {
  const common = [
    ['What is changing', 'change'],
    ['What the evidence shows', 'evidence'],
    ['Why it matters', 'impact'],
    ['What remains uncertain', 'limits'],
    ['What readers should watch next', 'next']
  ];
  if (category === 'How-To') return [['What you need to know first','change'],['Step-by-step approach','steps'],['How to check the result','evidence'],['Common limitations and failure points','limits'],['What to do next','next']];
  if (category === 'Product Launches') return [['What launched','change'],['What is actually available','evidence'],['Who is likely to benefit','impact'],['Limits and availability caveats','limits'],['What to watch next','next']];
  if (category === 'Crypto') return [['What is happening','change'],['What the reporting confirms','evidence'],['Why market participants may care','impact'],['What is still uncertain','limits'],['What to watch next','next']];
  return common;
}

function makeParagraphs(facts, category, mode) {
  const pool = facts.slice();
  const take = () => pool.shift();
  const sections = buildSections(category);
  const out = [];
  for (const [heading, kind] of sections) {
    const chosen = [take(), take()].filter(Boolean);
    if (!chosen.length) continue;
    let p = '';
    if (kind === 'change') {
      p = `The immediate development is easier to understand when the available reporting is separated from interpretation. ${factSentence(chosen[0], 'The strongest available source describes')} ${chosen[1] ? factSentence(chosen[1], `A second source, ${publisher(chosen[1].source)}, reports`) : ''}`;
    } else if (kind === 'evidence') {
      p = `The evidence is not based on a single headline. ${factSentence(chosen[0], `The cited reporting from ${publisher(chosen[0].source)} says`)} ${chosen[1] ? factSentence(chosen[1], `Independent reporting adds`) : ''}`;
    } else if (kind === 'impact') {
      p = `For readers, the practical significance depends on what can be established rather than what a headline implies. ${factSentence(chosen[0], 'The available evidence points to')} ${chosen[1] ? factSentence(chosen[1], 'That context matters because') : ''}`;
    } else if (kind === 'limits') {
      p = `There are limits to what can responsibly be concluded from the available material. ${factSentence(chosen[0], 'One reported detail is')} ${chosen[1] ? factSentence(chosen[1], 'Another source makes clear that') : ''} These points should be treated as context, not as evidence for claims that the sources do not make.`;
    } else if (kind === 'steps') {
      p = `A safe way to approach the task is to follow the evidence available for the specific device, service or version rather than assume every setup behaves the same way. ${factSentence(chosen[0], 'The supplied reporting establishes')} ${chosen[1] ? factSentence(chosen[1], 'It also reports') : ''}`;
    } else {
      p = `The next useful signal will be a concrete update that can be checked against the sources already identified. ${factSentence(chosen[0], 'The current reporting says')} ${chosen[1] ? factSentence(chosen[1], 'A related source reports') : ''} Until such evidence appears, stronger conclusions would go beyond the material available to this fallback writer.`;
    }
    out.push({ heading, paragraph: clean(p) });
  }
  return out;
}

function qualityText(text) {
  const sentences = sentenceSplit(text);
  const normalized = sentences.map(s => s.toLowerCase().replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ').trim());
  let duplicates = 0;
  for (let i=1;i<normalized.length;i++) if (normalized[i] === normalized[i-1]) duplicates++;
  const generic = /(in today's fast|it is important to note|in conclusion|game changer|revolutionary era)/gi;
  return { words: clean(text).split(/\s+/).filter(Boolean).length, sentences: sentences.length, duplicates, genericHits: (text.match(generic)||[]).length };
}

export async function generateNativeArticle({ candidate, related = null, trends = [], existingTitles = new Set() }) {
  if (!candidate?.title || !candidate?.category) return { ok:false, reason:'missing candidate' };
  related ||= relatedCandidate(candidate, trends);
  const sources = candidateSources(candidate, related);
  const fetched = (await Promise.all(sources.map(s => fetchSource(s.url)))).filter(Boolean);
  const usable = fetched.filter(x => x.sentences.length || x.description || x.title);
  const independentDomains = new Set(usable.map(x => x.domain).filter(Boolean));
  if (independentDomains.size < MIN_EVIDENCE) return { ok:false, reason:`native writer needs ${MIN_EVIDENCE} independent reachable sources; found ${independentDomains.size}` };

  const topic = `${candidate.title} ${candidate.description || ''} ${related?.title || ''}`;
  const evidence = chooseFacts(evidenceFor(candidate, related, usable), topic, 18);
  if (evidence.length < 8) return { ok:false, reason:'insufficient source evidence for a responsible native article' };

  const sections = makeParagraphs(evidence, candidate.category, 'native');
  const title = clean(candidate.title.replace(/\s+-\s+[^-]+$/, '').trim());
  const description = `A source-backed TrendForge briefing on ${title.toLowerCase()}, separating reported information from interpretation and clearly marking what remains uncertain.`;
  const introFacts = evidence.slice(0,2).map(f => factSentence(f, 'The available reporting indicates')).join(' ');
  const content = [
    `The story is worth following because the available reporting points to a concrete development, but the evidence needs to be separated from speculation. This provider-independent briefing uses reachable source material and preserves uncertainty where the sources do not establish a stronger conclusion.`,
    introFacts,
    ...sections.flatMap(s => [`## ${s.heading}`, s.paragraph]),
  ].join('\n\n');

  const metrics = qualityText(content);
  const duplicateTitle = [...existingTitles].some(t => clean(t).toLowerCase() === title.toLowerCase());
  if (duplicateTitle) return { ok:false, reason:'duplicate title' };
  if (metrics.words < 700) return { ok:false, reason:`native article evidence produced only ${metrics.words} words; refusing to pad` };
  if (metrics.genericHits > 1 || metrics.duplicates > 0) return { ok:false, reason:'native quality checks failed' };

  return {
    ok:true,
    article:{ title, description, content, category:candidate.category, sources: usable.map(s => ({ title:s.title || s.domain || 'Source', url:s.finalUrl || s.url })).slice(0,4) },
    diagnostics:{ version:OUTPUT_VERSION, evidenceItems:evidence.length, reachableSources:usable.length, independentDomains:[...independentDomains], relatedCandidates: related?.sources?.length ? MAX_RELATED : 0, ...metrics }
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const input = 'data/scored-trends.json';
  if (!fs.existsSync(input)) process.exit(0);
  const payload = JSON.parse(fs.readFileSync(input, 'utf8'));
  const candidate = (payload.trends || []).find(x => x.eligible);
  const result = await generateNativeArticle({ candidate, trends:payload.trends || [] });
  console.log(JSON.stringify(result, null, 2));
}
