import fs from 'node:fs';
import { generateWithTrendForgeRepair } from './trendforge-writer-engine.mjs';
import { loadCanonicalRepairEvidence } from './repair-evidence-guard.mjs';

const articleDir='content/articles';
const briefPath='data/article-brief.json';
const claimPath='data/claim-verification.json';
const aiBudgetPath='data/ai-run-budget.json';
const repairProviderBudgetPath='data/ai-repair-run-budget.json';
const MAX_REPAIR_PROVIDER_ATTEMPTS=4;
const MAX_REPAIR_RECOVERY_PASSES=1;
const REPAIR_RECOVERY_WAIT_MS=15000;
const runKey=process.env.GITHUB_RUN_ID||`local-${new Date().toISOString().slice(0,10)}`;
const titleFrom=r=>(r.match(/^title:\s*"([\s\S]*?)"\s*$/m)?.[1]||'').trim();
const descriptionFrom=r=>(r.match(/^description:\s*"([\s\S]*?)"\s*$/m)?.[1]||'').trim();
const latestArticle=()=>{if(!fs.existsSync(articleDir))throw new Error('No article directory');const files=fs.readdirSync(articleDir).filter(f=>f.endsWith('.md')).sort((a,b)=>fs.statSync(`${articleDir}/${b}`).mtimeMs-fs.statSync(`${articleDir}/${a}`).mtimeMs);if(!files.length)throw new Error('No generated article found');return `${articleDir}/${files[0]}`;};
const parseJson=raw=>{const t=String(raw).trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/i,'');for(const x of [t,(()=>{const a=t.indexOf('{'),b=t.lastIndexOf('}');return a>=0&&b>a?t.slice(a,b+1):''})()]){if(!x)continue;try{return JSON.parse(x)}catch{}}throw new Error('Atomic repair output was not valid JSON');};
const replaceSentence=(body,original,replacement)=>{const needle=String(original).trim(),rep=String(replacement).trim();if(!needle)return{body,changed:false,deleted:false};const idx=body.indexOf(needle);if(idx<0)return{body,changed:false,deleted:false};return{body:`${body.slice(0,idx)}${rep}${body.slice(idx+needle.length)}`,changed:true,deleted:!rep};};
const beginRepairBudget=()=>{let original=null;try{const raw=JSON.parse(fs.readFileSync(aiBudgetPath,'utf8'));if(raw?.runKey===runKey&&Number.isFinite(raw?.attempts))original=raw;}catch{}fs.mkdirSync('data',{recursive:true});fs.writeFileSync(aiBudgetPath,JSON.stringify({runKey,attempts:0,updatedAt:new Date().toISOString(),scope:'repair-pass'},null,2)+'\n');console.log(`Grounding repair v11: isolated repair budget from writer budget for run ${runKey}.`);return original;};
const resetRepairProviderBudget=()=>{fs.mkdirSync('data',{recursive:true});fs.writeFileSync(repairProviderBudgetPath,JSON.stringify({runKey,attempts:0,updatedAt:new Date().toISOString(),scope:'repair-recovery-pass'},null,2)+'\n');};
const restoreWriterBudget=original=>{if(original){fs.writeFileSync(aiBudgetPath,JSON.stringify(original,null,2)+'\n');console.log(`Grounding repair v11: restored writer AI budget (${original.attempts} attempt(s)).`);}else{fs.writeFileSync(aiBudgetPath,JSON.stringify({runKey,attempts:0,updatedAt:new Date().toISOString()},null,2)+'\n');}};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function main(){
 const articlePath=latestArticle(),raw=fs.readFileSync(articlePath,'utf8');
 const brief=fs.existsSync(briefPath)?JSON.parse(fs.readFileSync(briefPath,'utf8')):null;
 const verification=fs.existsSync(claimPath)?JSON.parse(fs.readFileSync(claimPath,'utf8')):null;
 const claims=Array.isArray(verification?.claims)?verification.claims:Array.isArray(verification?.results)?verification.results:[];
 const failed=claims.filter(x=>x.status==='unsupported'||x.status==='partial'||x.status==='uncertain'||x.classification==='uncertain').slice(0,12);
 if(!failed.length){console.log('Grounding repair: no failed factual claims; article left unchanged.');return;}
 const canonical=loadCanonicalRepairEvidence({briefTitle:brief?.brief?.title||titleFrom(raw),failedClaims:failed});
 const canonicalByUrl=new Map(canonical.sources.map(source=>[source.url,source]));
 const evidence=canonical.claims.map((x,i)=>{const source=canonicalByUrl.get(x.bestUrl);return `FAILED CLAIM ${i+1}: ${x.claim}\nSTATUS: ${x.status||x.classification||'failed'}\nEVIDENCE: ${String(x.bestPassage||'').slice(0,3000)}\nSOURCE: ${x.bestSource||source?.title||''}\nURL: ${x.bestUrl||''}`}).join('\n\n');
 if(evidence.length<200)throw new Error('Current claim evidence is incomplete; grounding repair refused.');
 const oldTitle=titleFrom(raw),oldDescription=descriptionFrom(raw);
 const body=raw.replace(/^---[\s\S]*?---/,'').replace(/\n\s*##\s+Sources[\s\S]*$/i,'').trim();
 const basePrompt=[
  'You are TrendForge Atomic Grounding Repair v11.',
  'DO NOT rewrite the article. Return ONLY JSON containing an array named repairs.',
  'For each failed claim, provide exactly one repair object with keys: original, replacement.',
  'original MUST be copied verbatim from the current article sentence that contains the failed claim.',
  '',
  'REPAIR ORDER IS MANDATORY: REWRITE -> NARROW -> DELETE.',
  '1) REWRITE: First try to rewrite the sentence while preserving its original meaning as closely as possible and making every factual element directly supported by the supplied evidence.',
  '2) NARROW: If the complete sentence cannot be supported, reduce it to the smallest useful factual statement that IS supported. Preserve attribution, uncertainty, polarity, numbers, dates, entities and causal direction. A narrower true sentence is preferred over deleting the whole sentence.',
  '3) DELETE: Only when no safe evidence-supported rewrite or narrower statement exists, set replacement to an empty string.',
  'Never choose deletion merely because a sentence is difficult. Attempt a faithful rewrite first, then a narrower supported claim.',
  '',
  'HARD SAFETY RULES:',
  '- Publisher evidence supplied below is the ONLY factual source.',
  '- No model memory, common knowledge, inference, assumptions, new facts, numbers, dates, names, causes, motives, forecasts, comparisons or unsupported implications.',
  '- Never reverse factual polarity: increased/decreased, rise/fall, gain/loss, approve/reject, allow/ban, launch/cancel, confirm/deny, support/oppose.',
  '- Never change or invent a number, date, entity, attribution or causal relationship.',
  '- Preserve attribution when present. Never turn attributed information into an unattributed fact.',
  '- Do not relabel unsupported facts as editorial analysis.',
  '- Do not modify sentences that do not contain a failed claim.',
  '- Do not rewrite paragraphs, headings, title, description, source list or unrelated material.',
  '- If a failed claim is an editorial/context statement rather than a factual premise, preserve it only if it introduces no unsupported factual assertion.',
  '',
  `CURRENT ARTICLE:\n${body.slice(0,16000)}`,
  `FAILED CLAIMS AND THEIR EVIDENCE:\n${evidence}`,
  'Return JSON only: {"repairs":[{"original":"...","replacement":"..."}]}.'
 ].join('\n\n');
 const originalBudget=beginRepairBudget();
 try{
  let out=null,lastError=null;
  for(let pass=0;pass<=MAX_REPAIR_RECOVERY_PASSES;pass++){
   if(pass>0){
    console.log(`Grounding repair v11: recovery pass ${pass}/${MAX_REPAIR_RECOVERY_PASSES}; waiting ${Math.ceil(REPAIR_RECOVERY_WAIT_MS/1000)}s before re-checking providers.`);
    await sleep(REPAIR_RECOVERY_WAIT_MS);
    resetRepairProviderBudget();
   }
   const prompt=pass===0?basePrompt:`${basePrompt}\n\nRECOVERY PASS: A previous provider pass was unavailable or exhausted. Re-evaluate the same evidence and return the complete repairs array again. Prefer the smallest safe rewrite/narrowing; do not invent or delete merely to make the response shorter.`;
   try{out=await generateWithTrendForgeRepair({prompt});lastError=null;break;}
   catch(e){lastError=e;console.log(`Grounding repair v11: provider pass ${pass+1} failed — ${e?.message||String(e)}.`);}
  }
  if(!out)throw new Error(`Grounding repair provider failed after bounded recovery: ${lastError?.message||String(lastError)}`);
  const parsed=parseJson(out.text);
  if(!Array.isArray(parsed.repairs))throw new Error('Atomic repair response missing repairs array.');
  let updatedBody=body,applied=0,deleted=0,narrowedOrRewritten=0;
  for(const r of parsed.repairs.slice(0,12)){
    if(!r||typeof r.original!=='string'||typeof r.replacement!=='string')continue;
    const result=replaceSentence(updatedBody,r.original,r.replacement);
    if(!result.changed)continue;
    updatedBody=result.body;applied++;
    if(result.deleted)deleted++; else narrowedOrRewritten++;
  }
  if(!applied)throw new Error('Atomic repair produced no matching sentence replacements.');
  const frontmatter=raw.match(/^---[\s\S]*?---/)?.[0]||'---\n---';
  const sources=raw.match(/\n\s*##\s+Sources[\s\S]*$/i)?.[0]||'';
  fs.writeFileSync(articlePath,`${frontmatter}\n\n${updatedBody.trim()}\n${sources||''}\n`);
  fs.writeFileSync('data/grounding-repair.json',JSON.stringify({generatedAt:new Date().toISOString(),articlePath,provider:out.provider,previousTitle:oldTitle,newTitle:oldTitle,briefTitle:brief?.brief?.title||'',evidenceClaims:claims.length,failedClaims:failed.length,evidenceChars:evidence.length,mode:'atomic-sentence-repair-v11-rewrite-narrow-delete-isolated-recovery',repairOrder:['rewrite','narrow','delete'],maxProviderAttempts:MAX_REPAIR_PROVIDER_ATTEMPTS,maxRecoveryPasses:MAX_REPAIR_RECOVERY_PASSES,recoveryWaitMs:REPAIR_RECOVERY_WAIT_MS,providerAttempts:out.attempts??MAX_REPAIR_PROVIDER_ATTEMPTS,appliedRepairs:applied,rewriteOrNarrowRepairs:narrowedOrRewritten,deletedSentences:deleted,wordCountValidation:'not_applicable'},null,2)+'\n');
  console.log(`Grounding repair v11: applied ${applied} repair(s) — ${narrowedOrRewritten} rewritten/narrowed, ${deleted} deleted. Strategy: rewrite -> narrow -> delete. Recovery pass enabled; unrelated article content preserved using dedicated repair provider ${out.provider}.`);
 }finally{restoreWriterBudget(originalBudget);}
}
main().catch(e=>{console.error(`Grounding repair failed: ${e?.message||String(e)}`);process.exit(1)});
