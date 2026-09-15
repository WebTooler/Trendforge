import fs from 'node:fs';
import { generateWithTrendForgeWriter } from './trendforge-writer-engine.mjs';

const articleDir='content/articles';
const briefPath='data/article-brief.json';
const claimPath='data/claim-verification.json';
const titleFrom=r=>(r.match(/^title:\s*"([\s\S]*?)"\s*$/m)?.[1]||'').trim();
const descriptionFrom=r=>(r.match(/^description:\s*"([\s\S]*?)"\s*$/m)?.[1]||'').trim();
const parseJson=raw=>{const t=String(raw).trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/i,'');for(const x of [t,(()=>{const a=t.indexOf('{'),b=t.lastIndexOf('}');return a>=0&&b>a?t.slice(a,b+1):''})()]){if(!x)continue;try{return JSON.parse(x)}catch{}}throw new Error('Writer repair output was not valid JSON')};
const latestArticle=()=>{if(!fs.existsSync(articleDir))throw new Error('No article directory');const files=fs.readdirSync(articleDir).filter(f=>f.endsWith('.md')).sort((a,b)=>fs.statSync(`${articleDir}/${b}`).mtimeMs-fs.statSync(`${articleDir}/${a}`).mtimeMs);if(!files.length)throw new Error('No generated article found');return `${articleDir}/${files[0]}`};
const briefPassages=brief=>(brief?.grounding?.sources||[]).flatMap((s,i)=>(s.passages||[]).map((p,j)=>({source:`S${i+1}-P${j+1}`,text:String(p)})));
const compactEvidence=(brief,claims)=>{
 const failed=claims.filter(x=>x.status!=='verified'&&x.evidence).slice(0,12).map(x=>`CLAIM: ${x.claim}\nEVIDENCE: ${String(x.evidence).slice(0,1800)}\nSOURCE: ${x.bestSource||''}`).join('\n\n');
 const fallback=briefPassages(brief).sort((a,b)=>b.text.length-a.text.length).slice(0,16).map(x=>`[${x.source}] ${x.text.slice(0,1600)}`).join('\n\n');
 return [failed,fallback].filter(Boolean).join('\n\n').slice(0,26000);
};

async function main(){
 const articlePath=latestArticle(),raw=fs.readFileSync(articlePath,'utf8');
 const brief=fs.existsSync(briefPath)?JSON.parse(fs.readFileSync(briefPath,'utf8'):null;
 const verification=fs.existsSync(claimPath)?JSON.parse(fs.readFileSync(claimPath,'utf8')):null;
 const claims=Array.isArray(verification?.results)?verification.results:[];
 const evidence=compactEvidence(brief,claims);
 if(!evidence||evidence.length<500)throw new Error('Current claim evidence is incomplete; grounding repair refused.');
 const oldTitle=titleFrom(raw),oldDescription=descriptionFrom(raw);
 const oldBody=raw.replace(/^---[\s\S]*?---/,'').replace(/^\s*##\s+Sources[\s\S]*$/i,'').trim().slice(0,10000);
 const prompt=[
  'You are TrendForge strict grounding repair editor and fact-preserving rewrite engine.',
  'The previous article failed strict claim verification. Rewrite the SAME story, but rebuild the article sentence-by-sentence from the supplied publisher evidence.',
  'SOURCE OF TRUTH RULE: the supplied publisher evidence is the ONLY factual source. Do not use model memory, general knowledge, inference, assumptions, or facts from the old draft that are not explicitly supported by the evidence.',
  'CLAIM MAPPING RULE: every factual sentence in the new article must be a direct statement or close paraphrase of one or more supplied evidence blocks. If you cannot point to the evidence block that supports a sentence, DELETE the sentence.',
  'Do not invent or preserve unsupported numbers, dates, names, quotes, product specifications, percentages, causes, motives, forecasts, market effects, or availability claims.',
  'Do not turn an implication into a fact. Preserve attribution such as “the company said” or “the report found” when the evidence is attributed. Do not merge unrelated source stories.',
  'The old draft is only a structural reference. You may discard most of it. Prefer fewer strongly supported facts over a longer article filled with synthesis.',
  'Write original prose; do not copy source wording at length. Use 3-5 H2 headings only if the evidence supports enough sections. Target roughly 300-500 words, but NEVER pad to reach a word count.',
  `CURRENT TITLE: ${oldTitle}`,
  `CURRENT DESCRIPTION: ${oldDescription}`,
  `CURRENT DRAFT (STRUCTURE ONLY):\n${oldBody}`,
  `PUBLISHER EVIDENCE — THE ONLY FACTUAL SOURCE:\n${evidence}`,
  'Before producing the JSON, internally check every factual sentence against the evidence. Remove any sentence that cannot be grounded.',
  'Return ONLY JSON with exactly three string keys: title, description, content. Description must be at least 80 characters.'
 ].join('\n\n');
 let out;
 try{
  out=await generateWithTrendForgeWriter({prompt,category:brief?.brief?.category||process.env.TRENDFORGE_WRITER_CATEGORY||'Technology',expectedTitle:oldTitle});
 }catch(e){throw new Error(`Grounding repair provider failed: ${e?.message||String(e)}`)}
 const repaired=parseJson(out.text);
 if(!repaired.title?.trim()||!repaired.description?.trim()||!repaired.content?.trim())throw new Error('Repair returned incomplete fields.');
 if(repaired.content.trim().length<900)throw new Error('Repair returned content below safe editorial floor.');
 const frontmatter=raw.match(/^---[\s\S]*?---/)?.[0]||'---\n---';
 const sources=raw.match(/\n\s*##\s+Sources[\s\S]*$/i)?.[0]||'';
 const safeTitle=String(repaired.title).replace(/"/g,'\\"').replace(/\r?\n/g,' ');
 const safeDescription=String(repaired.description).replace(/"/g,'\\"').replace(/\r?\n/g,' ');
 const updatedFrontmatter=frontmatter.replace(/^title:\s*"[\s\S]*?"\s*$/m,`title: "${safeTitle}"`).replace(/^description:\s*"[\s\S]*?"\s*$/m,`description: "${safeDescription}"`).replace(/^publishedAt:\s*"[\s\S]*?"\s*$/m,`publishedAt: "${new Date().toISOString()}"`);
 fs.writeFileSync(articlePath,`${updatedFrontmatter}\n\n${repaired.content.trim()}\n${sources||''}\n`);
 fs.writeFileSync('data/grounding-repair.json',JSON.stringify({generatedAt:new Date().toISOString(),articlePath,provider:out.provider,previousTitle:oldTitle,newTitle:repaired.title,evidenceClaims:claims.length,evidenceChars:evidence.length,mode:'claim-to-evidence-repair-v3',providerAttempts:1},null,2)+'\n');
 console.log(`Grounding repair: rewritten ${articlePath} from claim-to-evidence publisher evidence using ${out.provider}.`);
}
main().catch(e=>{console.error(`Grounding repair failed: ${e?.message||String(e)}`);process.exit(1)});
