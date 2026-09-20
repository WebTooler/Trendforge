import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { articleToMarkdown, buildArticlePrompt, editorialGate, slugify, type ArticleBrief } from '../lib/article-engine';
import { copyrightSafetyGate } from '../lib/copyright-safety';
import { generateWithTrendForgeWriter } from './trendforge-writer-engine.mjs';
import { validateAuthoritativeEvidencePack } from './authoritative-evidence-pack.mjs';

type Trend = { title:string; link:string; source:string; sourceName?:string; publishedAt?:string; category:string; description?:string; eligible?:boolean; score?:number; sources?:{title?:string;url:string;publishedAt?:string}[] };
type VerificationRecord = { link:string; sources?:{title?:string;url?:string;domain?:string;ok?:boolean;status?:number;finalUrl?:string;discovered?:boolean;resolvedFrom?:string}[]; independentReachableDomains?:string[]; relevantReachableSourceCount?:number; status?:string };
type EvidencePackItem = { title:string; url:string; description:string; kind:string; passages:string[]; articleBody:string; articleBodyLength:number; publisherFamily?:string; verified?:boolean; primary?:boolean; lineage?:Record<string, unknown> };
const stopWords = new Set(['about','after','again','also','been','being','could','from','have','into','more','most','over','said','some','than','that','their','there','these','they','this','what','when','which','with','will','would','your','technology','tech','digital','latest','news','update','updates','guide','how','today','artificial','intelligence','company','companies','industry','development','developments','story','stories','article','articles']);
const topicWords=(text='')=>new Set(text.toLowerCase().split(/[^a-z0-9]+/).filter(w=>w.length>=4&&!stopWords.has(w)));
const publisherName=(item:Trend)=>{const explicit=(item.sourceName||item.source||'').trim();if(explicit&&explicit.toLowerCase()!=='google news')return explicit;const m=item.description?.match(/<font[^>]*>([^<]+)<\/font>/i);return m?.[1]?.trim()||explicit||'Unknown publisher';};
const blockedPublishers=new Set(['facebook.com','facebook','reddit','pinterest','youtube','tiktok','x.com']);
const isCrediblePublisher=(name:string)=>{const n=name.toLowerCase().trim();return !!n&&!blockedPublishers.has(n)&&!n.includes('facebook.com');};
const conceptGroups:Record<string,string[]>={ai_pacing:['slowdown','slowing','slow','pacing','restraint','restrain','caution','cautious','measured','pace','accelerate','acceleration'],ai_governance:['governance','policy','policies','regulation','regulatory','oversight','lawmakers','policymakers','government'],ai_risk:['risk','risks','safety','threat','threats','danger','dangers','harm','harms'],ai_capability:['open-weight','model','models','neural','robot','robots','machine-learning'],cybersecurity:['cyber','cybersecurity','vulnerability','vulnerabilities','exploit','exploits','malware','security','attack','attacks'],drones:['drone','drones','counter-drone','counterdrone','uav','uavs'],product_launch:['launch','launched','release','released','unveiled','debut','availability'],crypto:['bitcoin','ethereum','crypto','blockchain','token','tokens','defi']};
const profile=(text:string)=>{const words=topicWords(text);const concepts=new Set<string>();for(const [group,variants] of Object.entries(conceptGroups))if(variants.some(v=>words.has(v)))concepts.add(group);const entities=new Set<string>();for(const match of text.matchAll(/\b(?:OpenAI|Anthropic|Google|Microsoft|Meta|Amazon|Apple|NVIDIA|Tesla|xAI|Mistral|DeepMind|Sam Altman|Dario Amodei|Barack Obama|Donald Trump|Avi Loeb)\b/gi))entities.add(match[0].toLowerCase());return{words,concepts,entities};};
const ngrams=(words:string[],size=3)=>{const out=new Set<string>();for(let i=0;i<=words.length-size;i++)out.add(words.slice(i,i+size).join(' '));return out;};
const semanticDuplicate=(candidateText:string,existingText:string)=>{const a=profile(candidateText),b=profile(existingText);const sharedConcepts=[...a.concepts].filter(x=>b.concepts.has(x));const sharedEntities=[...a.entities].filter(x=>b.entities.has(x));const sharedWords=[...a.words].filter(x=>b.words.has(x));const union=new Set([...a.words,...b.words]).size||1;const jaccard=sharedWords.length/union;const minSize=Math.max(1,Math.min(a.words.size,b.words.size));const containment=sharedWords.length/minSize;const phraseA=ngrams([...a.words],3),phraseB=ngrams([...b.words],3);const sharedPhrases=[...phraseA].filter(x=>phraseB.has(x)).length;
  // Category, entity, or broad concepts are NOT duplicate signals by themselves.
  // A story is blocked only when there is strong lexical/phrase-level evidence that
  // the same underlying article has been reproduced. This allows multiple stories
  // about the same company, category, technology, or theme.
  const duplicate=(sharedWords.length>=24&&jaccard>=0.34)||(sharedWords.length>=18&&containment>=0.55)||(sharedPhrases>=4&&sharedWords.length>=12&&sharedEntities.length>=1);
  return{duplicate,sharedConcepts,sharedEntities,sharedWords,sharedPhrases,jaccard,containment};};
// Pre-generation screening must be conservative: a related topic should still reach
// the evidence/AI gates. Exact title duplication is already handled separately.
const existingTopicMatches=(candidate:Trend,existing:string[])=>existing.some(text=>semanticDuplicate(candidate.title,text).duplicate);
const relatedEnough=(candidate:Trend,item:Trend)=>{if(candidate.category.toLowerCase()!==item.category.toLowerCase())return false;const a=profile(`${candidate.title} ${candidate.description??''}`),b=profile(`${item.title} ${item.description??''}`);const candidateTitle=topicWords(candidate.title),itemTitle=topicWords(item.title);const titleOverlap=[...candidateTitle].filter(w=>itemTitle.has(w)).length;const descA=topicWords(candidate.description??''),descB=topicWords(item.description??'');const descOverlap=[...descA].filter(w=>descB.has(w)).length;const entityOverlap=[...a.entities].filter(e=>b.entities.has(e)).length;return titleOverlap>=2||entityOverlap>=1||(titleOverlap>=1&&descOverlap>=3);};
const domainOf=(value:string)=>{try{return new URL(value).hostname.replace(/^www\./,'').toLowerCase();}catch{return '';}}
const OFFICIAL_DOMAINS=new Set(['reginfo.gov','federalregister.gov','sec.gov','cftc.gov','ftc.gov','fcc.gov','fda.gov','nasa.gov','nist.gov','whitehouse.gov','congress.gov','supremecourt.gov','justice.gov','treasury.gov','state.gov','commerce.gov','energy.gov','epa.gov','gov.uk','europa.eu']);
const sourceRole=(source:{title?:string;url?:string}={})=>{const domain=domainOf(source.url||'');const title=String(source.title||'').toLowerCase();const officialDomain=[...OFFICIAL_DOMAINS].some(d=>domain===d||domain.endsWith('.'+d));const primarySignals=/\b(official|filing|filings|order|rules?|notice|docket|register|reginfo|regulatory agenda|press release|pressroom|statement|transcript|decision|proposed rule)\b/i.test(title);return officialDomain||primarySignals?'primary':'secondary'};
const isMirror=(value:string)=>{const d=domainOf(value);return d==='news.google.com'||d==='google.com'||d==='google.co.uk';};
const loadVerification=()=>{try{const raw=JSON.parse(fs.readFileSync('data/source-verification.json','utf8'));return new Map<string,VerificationRecord>((raw.records??[]).map((r:VerificationRecord)=>[r.link,r]));}catch{return new Map<string,VerificationRecord>();}};
const verifiedEvidence=(item:Trend,verification:Map<string,VerificationRecord>)=>{const record=verification.get(item.link);const sources=(record?.sources??[]).filter(s=>s.ok&&/^https:\/\//.test(s.finalUrl||s.url||'')&&!isMirror(s.finalUrl||s.url||'')&&isCrediblePublisher(s.domain||domainOf(s.finalUrl||s.url||'')));const deduped:typeof sources=[];const seenDomains=new Set<string>();for(const source of sources.sort((a,b)=>Number(Boolean(b.discovered))-Number(Boolean(a.discovered)))){const domain=source.domain||domainOf(source.finalUrl||source.url||'');if(!domain||seenDomains.has(domain))continue;seenDomains.add(domain);deduped.push(source);}return{record,sources:deduped,domains:[...seenDomains]};};

const cleanHtml=(html='')=>String(html).replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<noscript[\s\S]*?<\/noscript>/gi,' ').replace(/<svg[\s\S]*?<\/svg>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&#39;|&apos;/gi,"'").replace(/&quot;/gi,'"').replace(/&#x27;/gi,"'").replace(/&#x2F;/gi,'/').replace(/\s+/g,' ').trim();
const splitSentences=(text='')=>String(text).replace(/\s+/g,' ').split(/(?<=[.!?])\s+(?=[A-Z0-9"“])/).map(s=>s.trim()).filter(s=>s.length>=45&&s.length<=700);
const jsonLdObjects=(html='')=>[...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].flatMap(m=>{try{const x=JSON.parse(m[1]);return Array.isArray(x)?x:[x];}catch{return[];}}).flatMap(x=>x?.['@graph']||[x]).filter(Boolean);
const extractGroundedBody=(html='')=>{const structured=jsonLdObjects(html).filter(x=>['Article','NewsArticle','ReportageNewsArticle','AnalysisNewsArticle','BlogPosting'].some(t=>String(x?.['@type']||'').includes(t))).sort((a,b)=>String(b.articleBody||'').length-String(a.articleBody||'').length)[0];const article=[...html.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/gi)].map(m=>cleanHtml(m[1])).filter(x=>x.length>=300).sort((a,b)=>b.length-a.length)[0]||'';const main=[...html.matchAll(/<main\b[^>]*>([\s\S]*?)<\/main>/gi)].map(m=>cleanHtml(m[1])).filter(x=>x.length>=300).sort((a,b)=>b.length-a.length)[0]||'';const paragraphs=[...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map(m=>cleanHtml(m[1])).filter(x=>x.length>=50&&x.length<=2500).slice(0,120).join(' ');const candidates=[{text:cleanHtml(structured?.articleBody||''),kind:'jsonld'},{text:article,kind:'article'},{text:main,kind:'main'},{text:paragraphs,kind:'paragraphs'}].filter(x=>x.text.length>=300).sort((a,b)=>b.text.length-a.text.length);return{body:candidates[0]?.text||'',kind:candidates[0]?.kind||'none',headline:structured?.headline||'',description:structured?.description||''};};
const fetchGroundedSource=async(source:{title?:string;url:string},storyTitle:string)=>{try{const r=await fetch(source.url,{redirect:'follow',signal:AbortSignal.timeout(9000),headers:{'user-agent':'Mozilla/5.0 (compatible; TrendForge-writer-grounding/2.2)','accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8','accept-language':'en-US,en;q=0.9'}});const html=await r.text();if(!r.ok||isMirror(r.url||source.url))return null;const title=cleanHtml((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||''));const description=cleanHtml((html.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([\s\S]*?)["']/i)?.[1]||''));const extracted=extractGroundedBody(html);const topic=topicWords(`${storyTitle} ${description} ${extracted.headline||title}`);const sentences=splitSentences(extracted.body);const ranked=sentences.map((text,index)=>{const words=topicWords(text);const topicScore=[...topic].filter(x=>words.has(x)).length;const signalScore=(/\b(announced|launched|released|reported|said|found|survey|study|research|percent|million|billion|regulator|regulatory|policy|workers?|employees?|price|funding|investment|approved|blocked|investigation)\b/i.test(text)?1:0);return{text,index,score:topicScore*2+signalScore};}).sort((a,b)=>b.score-a.score||a.index-b.index);const selected:number[]=[];for(const item of ranked.filter(x=>x.score>0).slice(0,10)){for(const idx of [item.index-1,item.index,item.index+1])if(idx>=0&&idx<sentences.length&&!selected.includes(idx))selected.push(idx);if(selected.length>=18)break;}let passages=selected.sort((a,b)=>a-b).slice(0,18).map(i=>sentences[i].slice(0,900));if(!passages.length){const metadata=[extracted.headline,title,description].map(cleanHtml).filter(x=>x.length>=25);passages=metadata.slice(0,3);};if(!extracted.body&&passages.length===0)return null;return{title:extracted.headline||title||source.title||'',url:r.url||source.url,description,kind:extracted.kind,passages,articleBody:extracted.body,articleBodyLength:extracted.body.length};}catch{return null;}};
const buildEvidencePack=async(sources:{title?:string;url:string}[],storyTitle:string)=>{const attempts=await Promise.all(sources.slice(0,8).map(async source=>({source,evidence:await fetchGroundedSource(source,storyTitle)})));const pack=[];const seenDomains=new Set<string>();for(const {evidence} of attempts){if(!evidence||!evidence.passages.length)continue;const domain=domainOf(evidence.url);if(!domain||seenDomains.has(domain))continue;seenDomains.add(domain);pack.push(evidence);}return pack;};

type ProviderResult={text:string;provider:string};
const generateWithProviders=async(prompt:string,expectedTitle:string):Promise<ProviderResult>=>generateWithTrendForgeWriter({prompt,category:process.env.TRENDFORGE_WRITER_CATEGORY||'Technology',expectedTitle});
const WORLD_CATEGORY_SIGNALS=/\b(greenland|denmark|nato|president|prime minister|parliament|diplomatic|diplomacy|geopolitics|sanctions|treaty|ceasefire|government|sovereignty|united nations|u\.n\.|foreign policy|military alliance)\b/gi;
const classifyArticleCategory=(trend:Trend)=>{const text=`${trend.title} ${trend.description??''}`;const hits=new Set((text.match(WORLD_CATEGORY_SIGNALS)||[]).map(x=>x.toLowerCase()));const strong=/\b(greenland|denmark|nato|president|prime minister|parliament|geopolitics|sovereignty|diplomatic|treaty|ceasefire)\b/i.test(text);return strong&&hits.size>=2?'World':trend.category;};
const parseModelJson=(raw:string):{title:string;description:string;content:string}=>{const text=raw.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/i,'').trim();try{return JSON.parse(text);}catch{}const start=text.indexOf('{'),end=text.lastIndexOf('}');if(start>=0&&end>start){try{return JSON.parse(text.slice(start,end+1));}catch{}}throw new Error('AI output was not valid JSON');};

async function main(){
  const input='data/scored-trends.json',outputDir='content/articles';if(!fs.existsSync(input))process.exit(0);
  const payload=JSON.parse(fs.readFileSync(input,'utf8')) as {trends?:Trend[]};const trends=payload.trends??[];
  const existingTitles=new Set<string>();const existingTopics:string[]=[];
  if(fs.existsSync(outputDir))for(const file of fs.readdirSync(outputDir).filter(n=>n.endsWith('.md'))){const raw=fs.readFileSync(`${outputDir}/${file}`,'utf8');const title=raw.match(/^title:\s*"([\s\S]*?)"\s*$/m)?.[1];if(title)existingTitles.add(title.toLowerCase().trim());const category=raw.match(/^category:\s*"([\s\S]*?)"\s*$/m)?.[1]||'';const body=raw.replace(/^---[\s\S]*?---/,'').slice(0,6500);existingTopics.push(`${category} ${title??''} ${body}`);}
  const verification=loadVerification();
  const eligible=trends.filter(i=>i.eligible&&!existingTitles.has(i.title.toLowerCase().trim())&&!existingTopicMatches(i,existingTopics)).sort((a,b)=>(b.score??0)-(a.score??0));
  const findRelated=(candidate:Trend)=>{const pa=publisherName(candidate);return trends.filter(item=>{if(item===candidate||item.link===candidate.link||existingTopicMatches(item,existingTopics))return false;const pb=publisherName(item);if(!isCrediblePublisher(pb)||pa.toLowerCase()===pb.toLowerCase())return false;const evidence=verifiedEvidence(item,verification);return evidence.sources.length>=2&&relatedEnough(candidate,item);}).sort((a,b)=>(b.score??0)-(a.score??0))[0];};
  const trend=eligible.find(candidate=>{const evidence=verifiedEvidence(candidate,verification);return evidence.sources.length>=1;});
  if(!trend){console.log('No new eligible trend with at least one independent reachable verified publisher evidence source and semantic uniqueness found.');process.exit(0);}
  const category=classifyArticleCategory(trend);
  process.env.TRENDFORGE_WRITER_CATEGORY=category;
  console.log(`Editorial category: ${trend.category} -> ${category}`);
  const authoritativePath='data/authoritative-evidence-pack.json';
  let authoritative=null;
  if(!fs.existsSync(authoritativePath)){
    console.log('Authoritative Evidence Pack missing; publication blocked.');
    process.exit(0);
  }
  try {
    // GitHub Actions/workflow artifacts can occasionally carry a UTF-8 BOM or
    // whitespace before the JSON document. Normalize that at the boundary so a
    // valid canonical pack is not falsely treated as unreadable.
    const raw=fs.readFileSync(authoritativePath,'utf8').replace(/^\\uFEFF/,'').trim();
    authoritative=JSON.parse(raw);
  } catch (error) {
    const message=error instanceof Error ? error.message : String(error);
    console.log(`Authoritative Evidence Pack parse failed; publication blocked: ${message}`);
    process.exit(0);
  }
  const pack=(authoritative?.candidates??[]).find((item:any)=>item?.candidate?.link===trend.link);
  if(!pack||!validateAuthoritativeEvidencePack(pack)){
    console.log('Authoritative Evidence Pack missing or invalid for selected candidate; publication blocked.');
    process.exit(0);
  }
  const evidencePack:EvidencePackItem[]=(pack.sources??[]).map((source:any)=>({
    title:source.title,url:source.url,description:'',kind:source.extraction?.kind||'pre-writer',
    passages:source.passages||[],articleBody:source.body||'',articleBodyLength:(source.body||'').length,
    publisherFamily:source.publisherFamily,verified:source.verified,primary:source.primary,lineage:source.lineage
  }));
  const sources=evidencePack.map(s=>({title:s.title,url:s.url,publishedAt:trend.publishedAt,role:sourceRole(s)}));
  const sourceRelationship=sources.length>=2?'same-candidate strong verified evidence':'single-source verified evidence';
  const uniqueSourceDomains=[...new Set(sources.map(s=>domainOf(s.url)).filter(Boolean))];
  if(uniqueSourceDomains.length<1){console.log('Canonical evidence pack contains no reachable publisher domain; publication blocked.');process.exit(0);}
  console.log(`Authoritative Evidence Pack: consumed ${evidencePack.length} canonical source(s); no downstream source expansion.`);
  const usablePassages=evidencePack.reduce((n,s)=>n+s.passages.length,0);
  const sourceWithEvidence=evidencePack.filter(x=>x.passages.length>=1).length;
  const evidenceDomains=[...new Set(evidencePack.map(s=>domainOf(s.url)).filter(Boolean))];
  const strongEvidence=evidencePack.length>=2&&sourceWithEvidence>=2&&evidenceDomains.length>=2;
  const minimumPassages=strongEvidence?6:3;
  console.log(`Grounding preflight: ${sources.length} verified publisher URL(s) fetched; ${sourceWithEvidence} source(s) yielded evidence across ${evidenceDomains.length} domain(s).`);
  if(evidencePack.length<1||sourceWithEvidence<1||evidenceDomains.length<1||usablePassages<minimumPassages){console.log(`Grounding evidence pack incomplete: ${evidencePack.length} source(s), ${usablePassages} usable evidence passages, ${evidenceDomains.length} independent evidence domain(s); publication blocked before AI generation.`);process.exit(0);}
  const evidenceText=evidencePack.map((s,i)=>`SOURCE S${i+1}\
Publisher/article: ${s.title}\
URL: ${s.url}\
Evidence passages:\
${s.passages.map((p,j)=>`[S${i+1}-P${j+1}] ${p}`).join('\
')}`).join('\
\
');
  const primarySources=evidencePack.filter(s=>sourceRole(s)==='primary');
  evidencePack.sort((a,b)=>Number(sourceRole(b)==='primary')-Number(sourceRole(a)==='primary'));
  const evidenceInstruction=strongEvidence
    ? `Cross-check the development across ${evidenceDomains.length} independent reachable source domains. Prefer primary/official evidence when available, while retaining independent secondary reporting for corroboration.`
    : primarySources.length ? 'Prefer the primary/official source for claims it directly establishes; preserve attribution and uncertainty for secondary reporting.' : 'Ground the article entirely in the validated publisher source; preserve attribution and uncertainty where applicable.';
  const brief:ArticleBrief={title:trend.title,category,angle:'Explain what changed, why it matters, what is known versus uncertain, and what readers should watch next. Use only the retrieved evidence passages as factual context.',keyPoints:[trend.description??'Use only retrieved evidence passages.',evidenceInstruction],sources:evidencePack.map(s=>({title:s.title,url:s.url,publishedAt:trend.publishedAt}))};
  const prompt=buildArticlePrompt(brief)+`\
\
RETRIEVED EVIDENCE PACK — THIS IS THE ONLY FACTUAL KNOWLEDGE YOU MAY USE:\
${evidenceText}\
\
GROUNDING CONTRACT:\
- Every material factual statement must be supported by at least one evidence passage above.\
- Do not use model memory or outside knowledge to add facts, prices, numbers, dates, names, quotes, product details or causal claims.\
- If a detail is not explicitly supported by the evidence pack, omit it.\
- Preserve uncertainty and attribution when the evidence is uncertain or attributed.\
- Do not combine different stories merely because they share a keyword.\
- Do not invent quotations or statistics.\
- The evidence-pack source IDs are internal and must NOT appear in the published prose.\
- Prefer a smaller, fully grounded article over a longer article with unsupported context.\
\
OUTPUT FORMAT: Return ONLY one valid JSON object with exactly three string keys: title, description, content. No markdown fences, no commentary. IMPORTANT: title must be a descriptive original headline between 20 and 110 characters. description must be at least 80 characters. Target about 700-1000 words; 450 is the minimum publishable floor, but do not pad. Write an original synthesis and do not reproduce source sentences, paragraphs, or headlines.`;
  fs.mkdirSync('data',{recursive:true});fs.writeFileSync('data/article-brief.json',JSON.stringify({generatedAt:new Date().toISOString(),brief,prompt,sourceRelationship,verifiedEvidenceDomains:evidenceDomains,grounding:{version:7,strongEvidence,sourceCount:evidencePack.length,usablePassages,minimumUsablePassages:minimumPassages,primarySourceCount:primarySources.length,sources:evidencePack.map(s=>({title:s.title,url:s.url,role:sourceRole(s),kind:s.kind,articleBodyLength:s.articleBodyLength,passages:s.passages}))}},null,2));
  let output:ProviderResult;try{output=await generateWithProviders(prompt,trend.title);}catch(e){console.log(`${e instanceof Error?e.message:String(e)} Publishing blocked.`);process.exit(0);}
  console.log(`Article generation provider: ${output.provider}`);
  let generated:{title:string;description:string;content:string};try{generated=parseModelJson(output.text);}catch(e){console.log(`${e instanceof Error?e.message:String(e)}; publishing blocked.`);process.exit(0);}
  if(!generated.title?.trim()||!generated.description?.trim()||!generated.content?.trim()){console.log('AI output is missing required article fields; publishing blocked.');process.exit(0);}
  if(existingTitles.has(generated.title.toLowerCase().trim())){console.log('Generated article title duplicates an existing article; publication blocked.');process.exit(0);}
  const generatedDuplicate=existingTopics.map(text=>semanticDuplicate(`${generated.title} ${generated.description} ${generated.content.slice(0,5000)}`,text)).find(x=>x.duplicate);if(generatedDuplicate){console.log(`Generated article is semantically duplicate; shared concepts: ${generatedDuplicate.sharedConcepts.join(', ')}; entities: ${generatedDuplicate.sharedEntities.join(', ')}; shared phrases: ${generatedDuplicate.sharedPhrases}. Publication blocked.`);process.exit(0);}
  const article={...generated,slug:slugify(generated.title),category:brief.category,sources:brief.sources.map(s=>({title:s.title,url:s.url})),generatedAt:new Date().toISOString()};
  const editorial=editorialGate(article);const copyright=copyrightSafetyGate({content:article.content,sources:article.sources.map(s=>s.url),images:[]});
  fs.writeFileSync('data/editorial-gate.json',JSON.stringify({generatedAt:new Date().toISOString(),provider:output.provider,editorial,copyright,semanticDuplicateCheck:'passed',sourceRelationshipCheck:'passed',verifiedEvidenceDomains:evidenceDomains,primarySourceCount:primarySources.length,grounding:{sourceCount:evidencePack.length,usablePassages,primarySourceCount:primarySources.length}},null,2));
  if(!editorial.passed||!copyright.passed){console.log(`Quality/copyright gate blocked publication. editorial=${editorial.passed?'PASS':'FAIL'} copyright=${copyright.passed?'PASS':'FAIL'}`);process.exit(0);}
  fs.mkdirSync(outputDir,{recursive:true});fs.writeFileSync(`${outputDir}/${article.slug}.md`,articleToMarkdown(article));console.log(`Published article draft: ${article.slug}`);
}
main().catch(e=>{console.error(`Generator failed unexpectedly: ${e instanceof Error?e.message:String(e)}`);process.exit(1);});
