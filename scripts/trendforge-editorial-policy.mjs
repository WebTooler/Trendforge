export const EDITORIAL_POLICY_VERSION='1.3';

export const categoryProfiles={
  AI:'Explain the concrete development, evidence, implications, limitations, and uncertainty. Separate reported facts from interpretation and avoid hype.',
  Technology:'Explain what changed, how it works at a useful level, who it affects, practical impact, limitations, and what readers should watch.',
  'How-To':'Solve one clear task. Give prerequisites, ordered steps, verification, common failure points, safety/privacy notes, and relevant alternatives.',
  Innovation:'Explain the problem, proposed approach, evidence, maturity, limitations, and what would have to happen next.',
  'Product Launches':'State what launched, availability, supported products/platforms, sourced capabilities, pricing/access only when verified, limitations, and practical relevance.',
  'Digital Life':'Prioritize everyday usefulness, privacy/security, compatibility, trade-offs, and concrete actions. Avoid invented UI labels or device behavior.',
  Crypto:'Separate confirmed facts from market interpretation. Never invent prices, partnerships, token utility, exchange support, forecasts, or regulatory conclusions.'
};

export const hardRules=[
  'Write for a real reader first; search visibility is never the primary purpose.',
  'Use supplied research and verified sources as the factual boundary. Unsupported facts must be omitted.',
  'Never invent facts, dates, names, quotes, statistics, capabilities, prices, benchmarks, partnerships, regulatory actions, or user experiences.',
  'Never manufacture a quote or make a source appear to say something it does not say.',
  'Never copy, lightly rewrite, synonymize, translate, or stitch source articles into a replacement article.',
  'Create an original synthesis and clearly separate verified facts from interpretation.',
  'Do not combine unrelated stories merely because they share a category, keyword, company, or broad theme.',
  'Avoid repetitive coverage unless there is a genuinely material new development.',
  'Use natural language; avoid generic AI filler, hype, empty conclusions, and repetitive sentence patterns.',
  'Do not keyword-stuff or write headings only for SEO.',
  'Do not use fake first-person experience, testing, interviews, expertise, or personal verification.',
  'Do not give professional medical, legal, financial, or security certainty; state limitations where warranted.',
  'For security topics, focus on defensive understanding and safe remediation.',
  'For crypto, clearly distinguish facts from speculation and never present a prediction as fact.',
  'For how-to content, do not invent menu names, buttons, settings, paths, compatibility, or device behavior.',
  'Use source attribution naturally and preserve important uncertainty, disagreement, dates, and attribution.',
  'Every section must add new information, explanation, evidence, or actionable value.',
  'Do not pad articles to hit a word count. Brevity is preferable to repetition.',
  'Use descriptive headings and readable paragraphs; avoid walls of text and artificial bullet spam.',
  'Return exactly the requested structured output and nothing else.',
  'A failed provider, quota exhaustion, or missing source is never a reason to lower editorial standards.',
  'If evidence is insufficient, refuse or defer publication rather than filling gaps with plausible text.'
];

export const qualityTargets={
  minWords:400,
  preferredMinWords:700,
  preferredMaxWords:1100,
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
  const words=wordCount(content),sentences=sentenceCount(content),h2=h2Count(content);
  const sentencesList=(content.match(/[^.!?]+[.!?](?:\s|$)/g)||[]).map(normalizedSentence).filter(Boolean);
  let duplicateSentence=false;
  for(let i=1;i<sentencesList.length;i++)if(sentencesList[i]===sentencesList[i-1]){duplicateSentence=true;break;}
  const fillerPatterns=[/in today's (?:fast|ever-changing|rapidly changing) world/i,/it is important to note that/i,/in conclusion/i,/this article (?:will|has) (?:explore|explored|discuss)/i,/whether you are a (?:beginner|seasoned|casual)/i,/game[- ]changer/i,/revolutionary (?:new )?era/i];
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
  if(sentences<10)errors.push('article has too few complete sentences');
  if(duplicateSentence)errors.push('consecutive duplicate sentence detected');
  if(fillerHits>=2)errors.push('generic/filler phrasing threshold exceeded');
  return {passed:errors.length===0,category,policyVersion:EDITORIAL_POLICY_VERSION,metrics:{words,sentences,h2,titleChars:title.trim().length,descriptionChars:description.trim().length,fillerHits},errors};
}

export function buildWriterContract(category='Technology'){
  const profile=categoryProfiles[category]||categoryProfiles.Technology;
  return [`TREND FORGE WRITER ENGINE — editorial policy v${EDITORIAL_POLICY_VERSION}`,`CATEGORY: ${category}`,`CATEGORY PROFILE: ${profile}`,'','NON-NEGOTIABLE EDITORIAL RULES:',...hardRules.map((rule,i)=>`${i+1}. ${rule}`),'',`QUALITY TARGETS: ${qualityTargets.preferredMinWords}-${qualityTargets.preferredMaxWords} words when evidence supports it; never pad. Use ${qualityTargets.preferredH2}-${qualityTargets.maxH2} useful H2 sections when appropriate.`,`LENGTH POLICY: ${qualityTargets.minWords} words is the minimum publishable draft floor. Around ${qualityTargets.preferredMinWords}+ words is preferred when evidence supports it. A shorter article is valid if complete, useful, well sourced, and all downstream gates pass.`,'STRUCTURE: strong original headline → useful opening → evidence/context → implications or steps → limitations/uncertainty → practical takeaway.','FACT DISCIPLINE: every material factual claim must be traceable to supplied research or verified source evidence.','ORIGINALITY: synthesize; do not imitate source wording, headline, structure, or paragraph order.','STYLE: clear, human, specific, restrained, informative.','','OUTPUT: Return ONLY one valid JSON object with exactly three string keys: title, description, content. No markdown fences and no commentary.'].join('\n');
}
