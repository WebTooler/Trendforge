import fs from 'node:fs';
import { generateWithTrendForgeRepair } from './trendforge-writer-engine.mjs';

const articleDir='content/articles';
const briefPath='data/article-brief.json';
const claimPath='data/claim-verification.json';
const aiBudgetPath='data/ai-run-budget.json';
const MAX_REPAIR_PROVIDER_ATTEMPTS=4;
const runKey=process.env.GITHUB_RUN_ID||`local-${new Date().toISOString().slice(0,10)}`;
const titleFrom=r=>(r.match(/^title:\s*"([\s\S]*?)"\s*$/m)?.[1]||'').trim();
const descriptionFrom=r=>(r.match(/^description:\s*"([\s\S]*?)"\s*$/m)?.[1]||'').trim();
const latestArticle=()=>{if(!fs.existsSync(articleDir))throw new Error('No article directory');const files=fs.readdirSync(articleDir).filter(f=>f.endsWith('.md')).sort((a,b)=>fs.statSync(`${articleDir}/${b}`).mtimeMs-fs.statSync(`${articleDir}/${a}`).mtimeMs);if(!files.length)throw new Error('No generated article found');return `${articleDir}/${files[0]}`;};
const parseJson=raw=>{const t=String(raw).trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/i,'');for(const x of [t,(()=>{const a=t.indexOf('{'),b=t.lastIndexOf('}');return a>=0&&b>a?t.slice(a,b+1):''})()]){if(!x)continue;try{return JSON.parse(x)}catch{}}throw new Error('Atomic repair output was not valid JSON');};
const replaceSentence=(body,original,replacement)=>{const needle=String(original).trim(),rep=String(replacement).trim();if(!needle)return{body,changed:false,deleted:false};const idx=body.indexOf(needle);if(idx<0)return{body,changed:false,deleted:false};return{body:`${body.slice(0,idx)}${rep}${body.slice(idx+needle.length)}`,changed:true,deleted:!rep};};
const beginRepairBudget=()=>{let original=null;try{const raw=JSON.parse(fs.readFileSync(aiBudgetPath,'utf8'));if(raw?.runKey===runKey&&Number.isFinite(raw?.attempts))original=raw;}catch{}fs.mkdirSync('data',{recursive:true});fs.writeFileSync(aiBudgetPath,JSON.stringify({runKey,attempts:0,updatedAt:new Date().toISOString(),scope:'repair-pass'},null,2)+'\n');console.log(`Grounding repair v9: isolated repair budget from writer budget for run ${runKey}.`);return original;};
const restoreWriterBudget=original=>{if(original){fs.writeFileSync(aiBudgetPath,JSON.stringify(original,null,2)+'\n');console.log(`Grounding repair v9: restored writer AI budget (${original.attempts} attempt(s)).`);}else{fs.writeFileSync(aiBudgetPath,JSON.stringify({runKey,attempts:0,updatedAt:new Date().toISOString()},null,2)+'\n');}};

async function main(){
 const articlePath=latestArticle(),raw=fs.readFileSync(articlePath,'utf8');
 const brief=fs.existsSync(briefPath)?JSON.parse(fs.readFileSync(briefPath,'utf8')):null;
 const verification=fs.existsSync(claimPath)?JSON.parse(fs.readFileSync(claimPath,'utf8')):null;
 const claims=Array.isArray(verification?.claims)?verification.claims:Array.isArray(verification?.results)?verification.results:[];
 // 'uncertain' is a review/repair state in the semantic verifier. Keep backward
 // compatibility with older verifier output that called the same state 'partial'.
 const failed=claims.filter(x=>x.status==='unsupported'||x.status==='partial'||x.status==='uncertain'||x.classification==='uncertain').slice(0,12);
 if(!failed.length){console.log('Grounding repair: no failed factual claims; article left unchanged.');return;}
 const evidence=failed.map((x,i)=>`FAILED CLAIM ${i+1}: ${x.claim}\nSTATUS: ${x.status||x.classification||'failed'}\nEVIDENCE: ${String(x.evidence||'').slice(0,3000)}\nSOURCE: ${x.bestSource||''}\nURL: ${x.bestUrl||''}`).join('\n\n');
 if(evidence.length<200)throw new Error('Current claim evidence is incomplete; grounding repair refused.');
 const oldTitle=titleFrom(raw),oldDescription=descriptionFrom(raw);
 const body=raw.replace(/^---[\s\S]*?---/,'').replace(/\n\s*##\s+Sources[\s\S]*$/i,'').trim();
 const prompt=[
  'You are TrendForge atomic grounding repair editor.',
  'DO NOT rewrite the article. Return ONLY JSON containing an array named repairs.',
  'For each failed claim, provide exactly one repair object with keys: original, replacement.',
  'original MUST be copied verbatim from the current article sentence that contains the failed claim.',
  'replacement MUST be the smallest evidence-supported replacement for that sentence.',
  'If the evidence cannot support any safe replacement, set replacement to an empty string so the sentence is deleted.',
  'Do not alter any sentence that does not contain a failed claim. Do not rewrite paragraphs, headings, title, description, or the rest of the article.',
  'Publisher evidence supplied below is the ONLY factual source. No model memory, inference, assumptions, new facts, numbers, dates, names, causes, motives, forecasts, or comparisons.',
  'Preserve attribution when present. A narrower supported claim is preferable to deletion. Never turn attributed information into an unattributed fact.',
  'Do not relabel unsupported facts as editorial analysis. Do not pad or shorten unrelated material.',
  `CURRENT ARTICLE:\n${body.slice(0,16000)}`,
  `FAILED CLAIMS AND THEIR EVIDENCE:\n${evidence}`,
  'Return JSON only: {"repairs":[{"original":"...","replacement":"..."}]}.'
 ].join('\n\n');
 const originalBudget=beginRepairBudget();
 try{
  let out;
  try{out=await generateWithTrendForgeRepair({prompt});}
  catch(e){throw new Error(`Grounding repair provider failed: ${e?.message||String(e)}`)}
  const parsed=parseJson(out.text);
  if(!Array.isArray(parsed.repairs))throw new Error('Atomic repair response missing repairs array.');
  let updatedBody=body,applied=0,deleted=0;
  for(const r of parsed.repairs.slice(0,12)){if(!r||typeof r.original!=='string'||typeof r.replacement!=='string')continue;const result=replaceSentence(updatedBody,r.original,r.replacement);if(!result.changed)continue;updatedBody=result.body;applied++;if(result.deleted)deleted++;}
  if(!applied)throw new Error('Atomic repair produced no matching sentence replacements.');
  const frontmatter=raw.match(/^---[\s\S]*?---/)?.[0]||'---\n---';
  const sources=raw.match(/\n\s*##\s+Sources[\s\S]*$/i)?.[0]||'';
  fs.writeFileSync(articlePath,`${frontmatter}\n\n${updatedBody.trim()}\n${sources||''}\n`);
  fs.writeFileSync('data/grounding-repair.json',JSON.stringify({generatedAt:new Date().toISOString(),articlePath,provider:out.provider,previousTitle:oldTitle,newTitle:oldTitle,evidenceClaims:claims.length,failedClaims:failed.length,evidenceChars:evidence.length,mode:'atomic-sentence-replacement-v9-isolated-repair-budget',maxProviderAttempts:MAX_REPAIR_PROVIDER_ATTEMPTS,providerAttempts:out.attempts??MAX_REPAIR_PROVIDER_ATTEMPTS,appliedRepairs:applied,deletedSentences:deleted,wordCountValidation:'not_applicable'},null,2)+'\n');
  console.log(`Grounding repair v9: applied ${applied} atomic sentence repair(s) (${deleted} deleted unsupported sentence(s)); unrelated article content preserved using dedicated repair provider ${out.provider}.`);
 }finally{restoreWriterBudget(originalBudget);}
}
main().catch(e=>{console.error(`Grounding repair failed: ${e?.message||String(e)}`);process.exit(1)});
