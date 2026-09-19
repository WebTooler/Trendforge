const DOMAIN_TIERS = [
  { score: 10, domains: ['reuters.com','apnews.com','bbc.com','nytimes.com','wsj.com','ft.com','theguardian.com','bloomberg.com'] },
  { score: 9, domains: ['techcrunch.com','theverge.com','arstechnica.com','wired.com','technologyreview.com','news.mit.edu','nature.com','sciencemag.org'] },
  { score: 8, domains: ['openai.com','anthropic.com','google.com','blog.google','microsoft.com','apple.com','meta.com','nvidia.com'] },
  { score: 7, domains: ['github.com','huggingface.co','ycombinator.com'] }
];

const clean = (s='') => String(s).replace(/\s+/g, ' ').trim();
const domainOf = (url='') => {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./,''); } catch { return ''; }
};

const provenanceText = (source={}) => clean(source.body || (Array.isArray(source.passages) ? source.passages.join(' ') : ''));
const provenanceTokens = (text='') => new Set(clean(text).toLowerCase().replace(/[^a-z0-9]+/g,' ').split(/\s+/).filter(w => w.length >= 5));
const provenanceSimilarity = (a='', b='') => {
  const A=provenanceTokens(a), B=provenanceTokens(b);
  if(!A.size||!B.size)return 0;
  let shared=0; for(const token of A)if(B.has(token))shared++;
  return shared/Math.max(1,Math.min(A.size,B.size));
};
const sourceProvenanceGroups = (sources=[]) => {
  const parent=sources.map((_,i)=>i);
  const find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
  const union=(a,b)=>{a=find(a);b=find(b);if(a!==b)parent[b]=a;};
  for(let i=0;i<sources.length;i++)for(let j=i+1;j<sources.length;j++){
    const a=sources[i],b=sources[j];
    const bodySim=provenanceSimilarity(provenanceText(a),provenanceText(b));
    const titleSim=provenanceSimilarity(a.title||'',b.title||'');
    const da=domainOf(a.url||a.domain||''),db=domainOf(b.url||b.domain||'');
    const ab=provenanceText(a).toLowerCase(),bb=provenanceText(b).toLowerCase();
    const attribution=(da&&bb.includes(da))||(db&&ab.includes(db));
    if(bodySim>=0.32||(titleSim>=0.55&&bodySim>=0.18)||(attribution&&bodySim>=0.12))union(i,j);
  }
  const groups=new Map();
  for(let i=0;i<sources.length;i++){const root=find(i);if(!groups.has(root))groups.set(root,[]);groups.get(root).push(i);}
  return [...groups.values()];
};

const sourceAuthorityScore = (source={}) => {
  if (Number.isFinite(source.authorityScore)) return Math.max(0, Math.min(10, source.authorityScore));
  const domain = domainOf(source.url || source.domain || '');
  const tier = DOMAIN_TIERS.find(t => t.domains.some(d => domain === d || domain.endsWith('.'+d)));
  return tier?.score || 5;
};

const factualSignals = /\b(?:announced|launched|released|reported|said|found|study|research|survey|percent|million|billion|approved|blocked|investigation|according|official|ceo|company|product|model|agent|incident|policy|regulator|funding|investment|date|today|yesterday|2026|2025|2024)\b/gi;
const numberSignals = /\b(?:\d+(?:\.\d+)?%?|\$\s?\d[\d,.]*|€\s?\d[\d,.]*|£\s?\d[\d,.]*|\d[\d,.]*\s+(?:million|billion|thousand))\b/gi;
const dateSignals = /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|20\d{2})\b/gi;
const quoteSignals = /["“][^"”]{12,}["”]/g;

function unique(arr) { return [...new Set(arr.filter(Boolean))]; }

export function scoreEvidenceSource(source={}) {
  const passages = Array.isArray(source.passages) ? source.passages.map(clean).filter(Boolean) : [];
  const body = clean(source.body || passages.join(' '));
  const chars = body.length;
  const factualHits = (body.match(factualSignals) || []).length;
  const numberHits = (body.match(numberSignals) || []).length;
  const dateHits = (body.match(dateSignals) || []).length;
  const quoteHits = (body.match(quoteSignals) || []).length;
  const detailPoints = Math.min(10, numberHits * 2 + Math.min(3, dateHits) + Math.min(2, quoteHits));
  const factualPoints = Math.min(10, factualHits * 0.75);
  const depthPoints = Math.min(10, passages.length * 1.25 + Math.max(0, chars - 500) / 1000);
  const authorityPoints = sourceAuthorityScore(source);
  const primaryPoints = source.primary === true ? 5 : 0;
  const verifiedPoints = source.verified === false ? 0 : 5;
  const score = Math.round(Math.min(40, factualPoints + depthPoints + detailPoints + authorityPoints + primaryPoints + verifiedPoints));
  return {
    score,
    chars,
    passages: passages.length,
    factualSignals: factualHits,
    numberSignals: numberHits,
    dateSignals: dateHits,
    quoteSignals: quoteHits,
    authorityScore: authorityPoints,
    primary: source.primary === true,
    verified: source.verified !== false
  };
}

export function scoreEvidenceCoverage({ sources=[] }={}) {
  const usable = sources.filter(s => s && (Array.isArray(s.passages) ? s.passages.length : 0) > 0);
  const scoredSources = usable.map(scoreEvidenceSource);
  const totalChars = scoredSources.reduce((n,s)=>n+s.chars,0);
  const totalPassages = scoredSources.reduce((n,s)=>n+s.passages,0);
  const domainFamilies = unique(usable.map(s => s.publisherFamily || domainOf(s.url || s.domain || '')));
  const provenanceGroups = sourceProvenanceGroups(usable);
  const independentFamilies = provenanceGroups.map(group => domainFamilies.filter((_,index) => group.includes(index)).sort().join('|')).filter(Boolean);
  const primaryCount = scoredSources.filter(s=>s.primary).length;
  const verifiedCount = scoredSources.filter(s=>s.verified).length;
  const factualSignalsTotal = scoredSources.reduce((n,s)=>n+s.factualSignals,0);
  const detailSignals = scoredSources.reduce((n,s)=>n+s.numberSignals+s.dateSignals+s.quoteSignals,0);

  const sourceDepth = Math.min(15, scoredSources.length * 5);
  const independence = Math.min(15, independentFamilies.length * 5);
  const evidenceVolume = Math.min(15, totalChars / 1000);
  const passageDepth = Math.min(10, totalPassages / 3);
  const factualDensity = Math.min(15, factualSignalsTotal / 3);
  const detailRichness = Math.min(10, detailSignals * 1.5);
  const verification = Math.min(5, verifiedCount * 2.5);
  const primaryEvidence = Math.min(5, primaryCount * 5);
  const authority = scoredSources.length
    ? Math.min(5, (scoredSources.reduce((n,s)=>n+s.authorityScore,0) / scoredSources.length) / 2)
    : 0;

  const score = Math.round(Math.min(100,
    sourceDepth + independence + evidenceVolume + passageDepth +
    factualDensity + detailRichness + verification + primaryEvidence + authority
  ));

  let band = 'insufficient';
  if (score >= 75) band = 'rich';
  else if (score >= 55) band = 'usable';
  else if (score >= 40) band = 'thin';

  const blockers = [];
  if (usable.length === 0) blockers.push('no_usable_sources');
  if (independentFamilies.length < 2) blockers.push('single_publisher_family');
  if (totalChars < 1000) blockers.push('low_evidence_volume');
  if (totalPassages < 6) blockers.push('low_passage_depth');
  if (factualSignalsTotal < 6) blockers.push('low_factual_density');
  if (verifiedCount < usable.length) blockers.push('unverified_source_present');

  return {
    score,
    band,
    readyForRichArticle: score >= 55 && usable.length >= 1 && totalChars >= 1000,
    blockers,
    sourceCount: usable.length,
    independentPublisherFamilies: independentFamilies.length,
    domainPublisherFamilies: domainFamilies.length,
    provenanceGroups: provenanceGroups.map(group => group.map(index => ({domain:domainOf(usable[index].url||usable[index].domain||''),title:usable[index].title||'',index}))),
    syndicatedSourceGroups: provenanceGroups.filter(group => group.length>1).length,
    totalChars,
    totalPassages,
    factualSignals: factualSignalsTotal,
    detailSignals,
    primarySourceCount: primaryCount,
    verifiedSourceCount: verifiedCount,
    scoredSources
  };
}

export const evidenceCoverageBands = {
  rich: { min: 75, meaning: 'Enough evidence depth for a rich article blueprint.' },
  usable: { min: 55, meaning: 'Enough evidence for a bounded article; blueprint should stay evidence-led.' },
  thin: { min: 40, meaning: 'Evidence is present but article scope should be narrow.' },
  insufficient: { min: 0, meaning: 'Do not ask the writer to expand beyond the available evidence.' }
};
