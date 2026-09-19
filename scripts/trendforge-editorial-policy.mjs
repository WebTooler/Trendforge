export const EDITORIAL_POLICY_VERSION='1.5';

export const categoryProfiles={
  AI:'Explain the concrete development, evidence, implications, limitations, and uncertainty. Separate reported facts from interpretation and avoid hype.',
  Technology:'Explain what changed, how it works at a useful level, who it affects, practical impact, limitations, and what readers should watch.',
  'How-To':'Solve one clear task. Give prerequisites, ordered steps, verification, common failure points, safety/privacy notes, and relevant alternatives.',
  Innovation:'Explain the problem, proposed approach, evidence, maturity, limitations, and what would have to happen next.',
  'Product Launches':'State what launched, availability, supported products/platforms, sourced capabilities, pricing/access only when verified, limitations, and practical relevance.',
  'Digital Life':'Prioritize everyday usefulness, privacy/security, compatibility, trade-offs, and concrete actions. Avoid invented UI labels or device behavior.',
  Crypto:'Separate confirmed facts from market interpretation. Never invent prices, partnerships, token utility, exchange support, forecasts, or regulatory conclusions.',
  World:'Explain international developments with clear attribution, sovereignty/authority distinctions, relevant context, and explicit uncertainty. Preserve what governments, officials, media reports, and agreements each actually establish.'
};

export const hardRules=[
  'Write for a real reader first; search visibility is never the primary purpose.',
  'Use supplied research and verified sources as the factual boundary. Unsupported facts must be omitted.',
  'Never invent facts, dates, names, quotes, statistics, capabilities, prices, benchmarks, partnerships, regulatory actions, or user experiences.',
  'Never manufacture a quote or make a source appear to say something it does not say.',
  'Never copy, lightly rewrite, synonymize, translate, or stitch source articles into a replacement article.',
  'Create an original synthesis and clearly separate verified facts from interpretation.',
  'Semantic freedom is allowed: paraphrase, re-order, explain, contextualize, and synthesize evidence-backed facts in original language. Exact source wording is not required.',
  'A reasonable synthesis may combine multiple supplied passages when the combined statement does not add a new factual premise, stronger certainty, new number, new entity, new causal claim, or unsupported outcome.',
  'Editorial context and interpretation are allowed when clearly framed as analysis, implication, limitation, or reader guidance. They must not smuggle in a new factual premise.',
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

export const qualityTargets={minWords:400,preferredMinWords:700,preferredMaxWords:1100,hardMaxWords:1500,minH2:1,preferredH2:null,maxH2:null,minDescriptionChars:100,maxDescriptionChars:320,maxTitleChars:110,minTitleChars:20,maxConsecutiveDuplicateSentences:1};
const wordCount=(text='')=>text.trim().split(/\s+/).filter(Boolean).length;
const sentenceCount=(text='')=>(text.match(/[.!?](?:\s|$)/g)||[]).length;
const h2Count=(text='')=>(text.match(/^##\s+.+$/gm)||[]).length;
const completeSentence=(s='')=>/[^.!?…]$/.test(s.trim())===false;
const normalizedSentence=(s='')=>s.toLowerCase().replace(/[^a-z0-9\s]/g,'').replace(/\s+/g,' ').trim();
const sentenceTokens=(s='')=>new Set(normalizedSentence(s).split(/\s+/).filter(w=>w.length>=4));
const sentenceSimilarity=(a='',b='')=>{const A=sentenceTokens(a),B=sentenceTokens(b);if(!A.size||!B.size)return 0;return[...A].filter(x=>B.has(x)).length/Math.max(1,Math.min(A.size,B.size));};
export function validateDraft({title='',description='',content='',category='Technology'}){
 const words=wordCount(content),sentences=sentenceCount(content),h2=h2Count(content);const sentencesList=(content.match(/[^.!?]+[.!?](?:\s|$)/g)||[]).map(normalizedSentence).filter(Boolean);let duplicateSentence=false;for(let i=1;i<sentencesList.length;i++)if(sentencesList[i]===sentencesList[i-1]){duplicateSentence=true;break;}let repeatedSentence=false;for(let i=0;i<sentencesList.length&&!repeatedSentence;i++)for(let j=i+2;j<sentencesList.length;j++){const a=sentencesList[i],b=sentencesList[j];if(a.length<90||b.length<90)continue;if(a===b||sentenceSimilarity(a,b)>=0.88){repeatedSentence=true;break;}}
 const fillerPatterns=[/in today's (?:fast|ever-changing|rapidly changing) world/i,/it is important to note that/i,/in conclusion/i,/this article (?:will|has) (?:explore|explored|discuss)/i,/whether you are a (?:beginner|seasoned|casual)/i,/game[- ]changer/i,/revolutionary (?:new )?era/i];const fillerHits=fillerPatterns.filter(r=>r.test(content)).length;const titleOk=title.trim().length>=qualityTargets.minTitleChars&&title.trim().length<=qualityTargets.maxTitleChars;const descriptionOk=description.trim().length>=qualityTargets.minDescriptionChars&&description.trim().length<=qualityTargets.maxDescriptionChars;const structureOk=h2>=1;const lengthOk=words>=qualityTargets.minWords&&words<=qualityTargets.hardMaxWords;const errors=[];if(!titleOk)errors.push('title length outside policy');if(!descriptionOk)errors.push(`description length outside ${qualityTargets.minDescriptionChars}-${qualityTargets.maxDescriptionChars} characters`);if(!lengthOk)errors.push(`word count ${words} outside ${qualityTargets.minWords}-${qualityTargets.hardMaxWords}`);if(!structureOk)errors.push('article needs at least one useful H2 section');if(sentences<10)errors.push('article has too few complete sentences');if(duplicateSentence)errors.push('consecutive duplicate sentence detected');if(repeatedSentence)errors.push('repeated factual sentence detected across article');
 const descTrim=description.trim();if(descTrim.length>=300&&!completeSentence(descTrim))errors.push('description appears truncated or incomplete');if(fillerHits>=2)errors.push('generic/filler phrasing threshold exceeded');return{passed:errors.length===0,category,policyVersion:EDITORIAL_POLICY_VERSION,metrics:{words,sentences,h2,titleChars:title.trim().length,descriptionChars:description.trim().length,fillerHits},errors};
}
export function buildWriterContract(category='Technology'){
 const profile=categoryProfiles[category]||categoryProfiles.Technology;return [`TREND FORGE WRITER ENGINE — editorial policy v${EDITORIAL_POLICY_VERSION}`,`CATEGORY: ${category}`,`CATEGORY PROFILE: ${profile}`,'','NON-NEGOTIABLE EDITORIAL RULES:',...hardRules.map((rule,i)=>`${i+1}. ${rule}`),'','SEMANTIC WRITING FREEDOM: Write like a professional newsroom writer, not a source copier. A sentence passes the evidence boundary when its meaning is supported by the evidence pack, even if its wording, order, grammar, emphasis, or framing differs from the source. You may paraphrase, contextualize, and synthesize multiple evidence passages. You may not introduce a new factual premise.','','QUALITY TARGETS: 700-1100 words when evidence supports it; never pad. Use the number of useful H2 sections the story naturally requires; do not pad or force a count.','LENGTH POLICY: 400 words is the minimum publishable draft floor. Around 700+ words is preferred when evidence supports it. A shorter article is valid if complete, useful, well sourced, and all downstream gates pass.','STRUCTURE: strong original headline → useful opening → evidence/context → implications or steps → limitations/uncertainty → practical takeaway.','FACT DISCIPLINE: every material factual claim must be traceable in meaning to supplied research or verified source evidence. Exact wording is not required.','ORIGINALITY: synthesize; do not imitate source wording, headline, structure, or paragraph order.','STYLE: clear, human, specific, restrained, informative.','','OUTPUT: Return ONLY one valid JSON object with exactly three string keys: title, description, content. No markdown fences and no commentary.'].join('\n');
}
