export const EDITORIAL_POLICY_VERSION='1.0';

export const categoryProfiles={
  AI:'Explain the concrete development, evidence, implications, limitations, and uncertainty. Separate reported facts from interpretation and avoid hype.',
  Technology:'Explain what changed, how it works at a useful level, who it affects, practical impact, limitations, and what readers should watch.',
  'How-To':'Solve one clear task. Give prerequisites, ordered steps, verification, common failure points, safety/privacy notes, and alternatives only when relevant.',
  Innovation:'Explain the problem, the proposed/new approach, evidence, maturity, limitations, and what would have to happen next.',
  'Product Launches':'State what launched, availability, supported products/platforms, sourced capabilities, pricing/access only when verified, limitations, and practical relevance.',
  'Digital Life':'Prioritize everyday usefulness, privacy/security, compatibility, trade-offs, and concrete actions. Avoid invented UI labels or device behavior.',
  Crypto:'Separate confirmed facts from market interpretation. Never invent prices, partnerships, token utility, exchange support, forecasts, or regulatory conclusions.'
};

export const hardRules=[
  'Write for a real reader first; search visibility is never the primary purpose of an article.',
  'Use the supplied research and verified sources as the factual boundary. If a fact is not supported, omit it or explicitly label it as uncertainty.',
  'Never invent facts, dates, names, quotes, statistics, product capabilities, prices, benchmarks, partnerships, regulatory actions, or user experiences.',
  'Never manufacture a quote or make a source appear to say something it does not say.',
  'Never copy, lightly rewrite, synonymize, translate, or stitch source articles into a replacement article.',
  'Create an original synthesis: explain why the development matters, connect verified facts, add useful context, and clearly mark interpretation.',
  'Do not publish an article merely because a trend exists. It must have a clear reader benefit and a distinct angle.',
  'Do not combine unrelated stories merely because they share a category, keyword, company, or broad theme.',
  'Avoid repetitive articles covering the same event, claim, entity, or angle unless there is a genuinely material new development.',
  'Use natural language. Avoid generic AI filler, exaggerated adjectives, empty conclusions, and repetitive sentence patterns.',
  'Do not use keyword stuffing, search-query lists, unnatural keyword repetition, or headings written only for SEO.',
  'Do not write clickbait that promises information the article does not deliver.',
  'Do not use fake first-person experience, fake testing, fake interviews, fake expertise, or claims that TrendForge personally verified something unless the pipeline actually did.',
  'Do not claim a product was tested, benchmarked, purchased, installed, or observed unless the supplied evidence supports that claim.',
  'Do not give professional medical, legal, financial, or security certainty. State limitations and recommend qualified help where the topic warrants it.',
  'For security topics, do not provide unnecessary operational instructions that enable abuse; focus on defensive understanding and safe remediation.',
  'For crypto, clearly distinguish facts from speculation and never present a prediction as a fact.',
  'For how-to content, do not invent menu names, button labels, settings, paths, compatibility, or device-specific behavior. Prefer version-aware caveats when uncertain.',
  'Use source attribution naturally when a claim depends on a particular publisher or statement.',
  'Preserve important uncertainty, disagreement, dates, and attribution instead of flattening them into certainty.',
  'Every section must add new information, explanation, evidence, or actionable value.',
  'Do not pad articles to hit a word count. Brevity is preferable to repetition.',
  'Do not end with a generic AI conclusion such as a restatement of the introduction. End with a useful takeaway, implication, or next step.',
  'Use descriptive headings that help readers scan the article. Do not overuse headings.',
  'Keep paragraphs readable and varied in length; avoid walls of text and one-sentence paragraph spam.',
  'Use lists only when they genuinely improve scanability; do not convert ordinary prose into artificial bullet lists.',
  'Do not include markdown fences, meta-commentary, writing notes, source-analysis notes, or instructions to the editor in article content.',
  'Return exactly the requested structured output and nothing else.',
  'A failed provider, quota exhaustion, or missing source is never a reason to lower editorial standards.',
  'If evidence is insufficient, the correct action is to refuse or defer publication, not to fill gaps with plausible-sounding text.'
];

export const qualityTargets={
  minWords:700,
  preferredMinWords:850,
  preferredMaxWords:1200,
  hardMaxWords:1500,
  minH2:3,
  preferredH2:4,
  maxH2:8,
  minDescriptionChars:100,
  maxTitleChars:110,
  minTitleChars:20,
  maxConsecutiveDuplicateSentences:1
};

const wordCount=(text='')=>text.trim().split(/\s+/).filter(Boolean).length;
const sentenceCount=(text='')=>(text.match(/[.!?](?:\s|$)/g)||[]).length;
const h2Count=(text='')=>(text.match(/^##\s+.+$/gm)||[]).length;
const normalizedSentence=(s='')=>s.toLowerCase().replace(/[^a-z0-9\s]/g,'').replace(/\s+/g,' ').trim();

export function validateDraft({title='',description='',content='',category='Technology'}){
  const words=wordCount(content);
  const sentences=sentenceCount(content);
  const h2=h2Count(content);
  const sentencesList=(content.match(/[^.!?]+[.!?](?:\s|$)/g)||[]).map(normalizedSentence).filter(Boolean);
  let duplicateSentence=false;
  for(let i=1;i<sentencesList.length;i++)if(sentencesList[i]===sentencesList[i-1]){duplicateSentence=true;break;}
  const fillerPatterns=[
    /in today's (?:fast|ever-changing|rapidly changing) world/i,
    /it is important to note that/i,
    /in conclusion/i,
    /this article (?:will|has) (?:explore|explored|discuss)/i,
    /whether you are a (?:beginner|seasoned|casual)/i,
    /game[- ]changer/i,
    /revolutionary (?:new )?era/i
  ];
  const fillerHits=fillerPatterns.filter(r=>r.test(content)).length;
  const titleOk=title.trim().length>=qualityTargets.minTitleChars&&title.trim().length<=qualityTargets.maxTitleChars;
  const descriptionOk=description.trim().length>=qualityTargets.minDescriptionChars;
  const structureOk=h2>=qualityTargets.minH2&&h2<=qualityTargets.maxH2;
  const lengthOk=words>=qualityTargets.minWords&&words<=qualityTargets.hardMaxWords;
  const errors=[];
  if(!titleOk)errors.push('title length outside policy');
  if(!descriptionOk)errors.push('description too short');
  if(!lengthOk)errors.push(`word count ${words} outside ${qualityTargets.minWords}-${qualityTargets.hardMaxWords}`);
  if(!structureOk)errors.push(`H2 structure count ${h2} outside ${qualityTargets.minH2}-${qualityTargets.maxH2}`);
  if(sentences<12)errors.push('article has too few complete sentences');
  if(duplicateSentence)errors.push('consecutive duplicate sentence detected');
  if(fillerHits>=2)errors.push('generic/filler phrasing threshold exceeded');
  return {passed:errors.length===0,category,policyVersion:EDITORIAL_POLICY_VERSION,metrics:{words,sentences,h2,titleChars:title.trim().length,descriptionChars:description.trim().length,fillerHits},errors};
}

export function buildWriterContract(category='Technology'){
  const profile=categoryProfiles[category]||categoryProfiles.Technology;
  return [
    `TREND FORGE WRITER ENGINE — editorial policy v${EDITORIAL_POLICY_VERSION}`,
    `CATEGORY: ${category}`,
    `CATEGORY PROFILE: ${profile}`,
    '',
    'NON-NEGOTIABLE EDITORIAL RULES:',
    ...hardRules.map((rule,i)=>`${i+1}. ${rule}`),
    '',
    `QUALITY TARGETS: ${qualityTargets.preferredMinWords}-${qualityTargets.preferredMaxWords} words when the evidence supports it; never pad. Use ${qualityTargets.preferredH2}-${qualityTargets.maxH2} useful H2 sections when appropriate.`,
    'STRUCTURE: strong original headline → useful opening that answers what changed/why it matters → evidence/context → implications or steps → limitations/uncertainty → practical takeaway.',
    'FACT DISCIPLINE: every material factual claim must be traceable to supplied research or a source. Do not silently upgrade uncertainty into certainty.',
    'ORIGINALITY: synthesize; do not imitate the structure, wording, headline, or paragraph order of a source.',
    'STYLE: clear, human, specific, restrained, informative. Avoid hype and predictable AI phrasing.',
    '',
    'OUTPUT: Return ONLY one valid JSON object with exactly three string keys: title, description, content. No markdown fences and no commentary.'
  ].join('\n');
}
