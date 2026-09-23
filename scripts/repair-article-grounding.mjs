 if(exact)return exact.trim();
 const targetTokens=[...new Set(targetFp.split(/\\s+/).filter(x=>x.length>=4))];
 if(targetTokens.length<4)return'';
 let best='',bestScore=0;
 for(const sentence of sentences){
   const st=new Set(sentenceFingerprint(sentence).split(/\\s+/).filter(x=>x.length>=4));
   const shared=targetTokens.filter(x=>st.has(x)).length;
   const score=shared/Math.max(1,targetTokens.length);
   if(shared>=4&&score>bestScore){bestScore=score;best=sentence.trim();}
 }
 return bestScore>=0.6?best:'';
};
const replaceSentence=(body,original,replacement)=>{
 const needle=String(original).trim(),rep=String(replacement).trim();
 if(!needle)return{body,changed:false,deleted:false,count:0};
 const fp=sentenceFingerprint(needle);
 const sentences=sentenceList(body);
 let cursor=0,output='',changed=0;
 for(const sentence of sentences){
   const idx=body.indexOf(sentence,cursor);
   if(idx<0)continue;
   output+=body.slice(cursor,idx);
   if(sentenceFingerprint(sentence)===fp&&changed===0){output+=rep;changed++;}
   else output+=sentence;
   cursor=idx+sentence.length;
 }
 output+=body.slice(cursor);
 return{body:output.replace(/\\n{3,}/g,'\\n\\n').trim(),changed:changed>0,deleted:changed>0&&!rep,count:changed};
};
const removeSentenceByFingerprint=(body,target)=>{
 const fp=sentenceFingerprint(target);
 if(!fp)return{body,changed:false,count:0};
 const sentences=sentenceList(body);
 let cursor=0,output='',removed=0;
 for(const sentence of sentences){
   const idx=body.indexOf(sentence,cursor);
   if(idx<0)continue;
   output+=body.slice(cursor,idx);
   if(sentenceFingerprint(sentence)===fp){cursor=idx+sentence.length;removed++;}
   else{output+=sentence;cursor=idx+sentence.length;}
 }
 output+=body.slice(cursor);
 return{body:output.replace(/\\n{3,}/g,'\\n\\n').trim(),changed:removed>0,count:removed};
};
const beginRepairBudget=()=>{let original=null;try{const raw=JSON.parse(fs.readFileSync(aiBudgetPath,'utf8'));if(raw?.runKey===runKey&&Number.isFinite(raw?.attempts))original=raw;}catch{}fs.mkdirSync('data',{recursive:true});fs.writeFileSync(aiBudgetPath,JSON.stringify({runKey,attempts:0,updatedAt:new Date().toISOString(),scope:'repair-pass'},null,2)+'\n');console.log(`Grounding repair v11: isolated repair budget from writer budget for run ${runKey}.`);return original;};
const resetRepairProviderBudget=()=>{fs.mkdirSync('data',{recursive:true});fs.writeFileSync(repairProviderBudgetPath,JSON.stringify({runKey,attempts:0,updatedAt:new Date().toISOString(),scope:'repair-recovery-pass'},null,2)+'\n');};
const restoreWriterBudget=original=>{if(original){fs.writeFileSync(aiBudgetPath,JSON.stringify(original,null,2)+'\n');console.log(`Grounding repair v11: restored writer AI budget (${original.attempts} attempt(s)).`);}else{fs.writeFileSync(aiBudgetPath,JSON.stringify({runKey,attempts:0,updatedAt:new Date().toISOString()},null,2)+'\n');}};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const loadBlueprint=briefTitle=>{try{const root=JSON.parse(fs.readFileSync('data/pre-writer-pipeline.json','utf8'));const row=(root?.candidates||[]).find(x=>String(x?.title||'').trim()===String(briefTitle||'').trim());return row?.evidence?.blueprint||null;}catch{return null;}};

async function main(){
 const articlePath=latestArticle(),raw=fs.readFileSync(articlePath,'utf8');
 const brief=fs.existsSync(briefPath)?JSON.parse(fs.readFileSync(briefPath,'utf8')):null;
 const verification=fs.existsSync(claimPath)?JSON.parse(fs.readFileSync(claimPath,'utf8')):null;
 const claims=Array.isArray(verification?.claims)?verification.claims:Array.isArray(verification?.results)?verification.results:[];
 const failed=claims.filter(x=>x.status==='unsupported'||x.classification==='unsupported');
 if(!failed.length){console.log('Grounding repair: no failed factual claims; article left unchanged.');return;}
 const canonical=loadCanonicalRepairEvidence({briefTitle:brief?.brief?.title||titleFrom(raw),failedClaims:failed});
 const canonicalByUrl=new Map(canonical.sources.map(source=>[source.url,source]));
 const evidence=canonical.claims.map((x,i)=>{const source=canonicalByUrl.get(x.bestUrl);return `UNSUPPORTED CLAIM ${i+1}: ${x.claim}\nSTATUS: unsupported\nEVIDENCE: ${String(x.bestPassage||'').slice(0,700)}\nSOURCE: ${x.bestSource||source?.title||''}\nURL: ${x.bestUrl||''}`}).join('\n\n');
 if(evidence.length<200)throw new Error('Current claim evidence is incomplete; grounding repair refused.');
 const oldTitle=titleFrom(raw),oldDescription=descriptionFrom(raw);
 const body=raw.replace(/^---[\s\S]*?---/,'').replace(/\n\s*##\s+Sources[\s\S]*$/i,'').trim();
 const blueprint=loadBlueprint(brief?.brief?.title||oldTitle);
 const originalDepth=assessArticleDepth({content:body,blueprint});
 const minimumWords=Number(originalDepth?.rules?.minWords||blueprint?.targetWords?.min||300);
 const basePrompt=[
  'You are TrendForge Atomic Grounding Repair v11.',
  'DO NOT rewrite the article. Return ONLY JSON containing an array named repairs.',
  'Repair EVERY unsupported claim supplied below. Do not stop after the first successful repair.',
  'For each distinct affected article sentence, provide exactly one repair object with keys: original, replacement. If multiple unsupported claims occur in the same sentence, one replacement must fix ALL of them.',
  'original MUST be copied verbatim from the current article sentence that contains the unsupported claim.',
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
  `CURRENT ARTICLE:\n${body.slice(0,6000)}`,
  `FAILED CLAIMS AND THEIR EVIDENCE:\n${evidence}`,
  'Return JSON only: {"repairs":[{"original":"...","replacement":"..."}]}.'
 ].join('\n\n');
 const repairTargets=[...new Set(failed.map(x=>resolveClaimSentence(body,x?.sentence||x?.claim)).filter(Boolean))];
 const originalBudget=beginRepairBudget();
 try{
  let out=null,lastError=null,parsed=null,updatedBody=body,applied=0,deleted=0,narrowedOrRewritten=0,finalDepth=originalDepth;
  console.log(`Grounding repair v12: resolved ${repairTargets.length}/${failed.length} unsupported sentence target(s).`);
  for(let depthPass=0;depthPass<=MAX_DEPTH_RECOVERY_PASSES && !out;depthPass++){
   for(let providerPass=0;providerPass<=MAX_REPAIR_RECOVERY_PASSES && !out;providerPass++){
    if(providerPass>0 || depthPass>0){
     console.log(`Grounding repair v11: recovery pass depth=${depthPass}/${MAX_DEPTH_RECOVERY_PASSES}, provider=${providerPass}/${MAX_REPAIR_RECOVERY_PASSES}.`);
     if(providerPass>0){await sleep(REPAIR_RECOVERY_WAIT_MS);resetRepairProviderBudget();}
    }
    let prompt=basePrompt;
    if(providerPass>0) prompt+=`\n\nRECOVERY PASS: Re-evaluate the same evidence and return the complete repairs array again. Prefer the smallest safe rewrite/narrowing; do not invent or delete merely to make the response shorter.`;
    if(depthPass>0) prompt+='\n\nEVIDENCE-FIRST RECOVERY: Prefer removing unsupported material even if the article becomes shorter. Do not add facts to satisfy a length target.';
    try{
      out=await generateWithTrendForgeRepair({prompt});
      parsed=parseJson(out.text);
      if(!Array.isArray(parsed.repairs)) throw new Error('Atomic repair response missing repairs array.');
      updatedBody=body; applied=0; deleted=0; narrowedOrRewritten=0;
      for(const r of parsed.repairs.slice(0,12)){
       if(!r||typeof r.original!=='string'||typeof r.replacement!=='string')continue;
       const result=replaceSentence(updatedBody,r.original,r.replacement);
       if(!result.changed)continue;
       updatedBody=result.body;applied++;
       if(result.deleted)deleted++; else narrowedOrRewritten++;
      }
      if(!applied) throw new Error('Atomic repair produced no matching sentence replacements.');
      
      let uncoveredTargets=repairTargets.filter(target=>sentenceList(updatedBody).some(sentence=>sentenceFingerprint(sentence)===sentenceFingerprint(target)));
      if(uncoveredTargets.length){
        if(REPAIR_PASS==='surgical'){
          console.log(`Grounding repair v11 (surgical): deleting ${uncoveredTargets.length} unsupported target sentence(s) left unchanged by provider.`);
          for(const target of uncoveredTargets){
            const result=removeSentenceByFingerprint(updatedBody,target);
            if(result.changed){updatedBody=result.body;applied+=result.count;deleted+=result.count;}
          }
          uncoveredTargets=repairTargets.filter(target=>sentenceList(updatedBody).some(sentence=>sentenceFingerprint(sentence)===sentenceFingerprint(target)));
          if(uncoveredTargets.length) throw new Error(`Surgical repair left ${uncoveredTargets.length} unsupported target sentence(s) unchanged after deletion.`);
        }else{
          throw new Error(`Atomic repair did not cover all unsupported claims; ${uncoveredTargets.length} target sentence(s) remain unchanged.`);
        }
      }
      finalDepth=assessArticleDepth({content:updatedBody,blueprint});
    }catch(e){lastError=e;out=null;console.log(`Grounding repair v11: provider pass failed — ${e?.message||String(e)}.`);}
   }
  }
  if(!out){
    if(SURGICAL_DELETE_ON_PROVIDER_FAILURE){
      console.log('Grounding repair v11: surgical fallback — provider could not produce a valid repair; deleting remaining unsupported claims.');
      updatedBody=body; applied=0; deleted=0; narrowedOrRewritten=0;
      for(const claim of failed){
        const target=resolveClaimSentence(body,claim?.sentence||claim?.claim);
        if(!target) continue;
        const result=removeSentenceByFingerprint(updatedBody,target);
        if(result.changed){updatedBody=result.body;applied+=result.count;deleted+=result.count;}
      }
      const remainingTargets=repairTargets.filter(target=>sentenceList(updatedBody).some(sentence=>sentenceFingerprint(sentence)===sentenceFingerprint(target)));
      if(remainingTargets.length) throw new Error(`Surgical repair fallback left ${remainingTargets.length} unsupported target sentence(s) unchanged after deterministic deletion.`);
      if(!applied) throw new Error('Surgical repair could not locate any remaining unsupported claim sentence for deletion.');
      finalDepth=assessArticleDepth({content:updatedBody,blueprint});
      out={provider:'surgical-delete-fallback',attempts:0,text:''};
    }else{
      throw new Error(`Grounding repair provider failed after bounded depth-preserving recovery: ${lastError?.message||String(lastError)}`);
    }
  }
  const frontmatter=raw.match(/^---[\s\S]*?---/)?.[0]||'---\n---';
  const sources=raw.match(/\n\s*##\s+Sources[\s\S]*$/i)?.[0]||'';
  fs.writeFileSync(articlePath,`${frontmatter}\n\n${updatedBody.trim()}\n${sources||''}\n`);
  fs.writeFileSync('data/grounding-repair.json',JSON.stringify({generatedAt:new Date().toISOString(),runId:runKey,articlePath,provider:out.provider,previousTitle:oldTitle,newTitle:oldTitle,briefTitle:brief?.brief?.title||'',evidenceClaims:claims.length,failedClaims:failed.length,evidenceChars:evidence.length,mode:`atomic-sentence-repair-v12-${REPAIR_PASS}-fingerprint-rewrite-narrow-delete-isolated-recovery`,repairOrder:['rewrite','narrow','delete'],maxProviderAttempts:MAX_REPAIR_PROVIDER_ATTEMPTS,maxRecoveryPasses:MAX_REPAIR_RECOVERY_PASSES,recoveryWaitMs:REPAIR_RECOVERY_WAIT_MS,providerAttempts:out.attempts??MAX_REPAIR_PROVIDER_ATTEMPTS,appliedRepairs:applied,rewriteOrNarrowRepairs:narrowedOrRewritten,deletedSentences:deleted,wordCountValidation:{before:originalDepth.words,after:finalDepth.words,minimum:minimumWords,depthMode:finalDepth.mode,preservedFloor:finalDepth.words>=minimumWords}},null,2)+'\n');
  console.log(`Grounding repair v12 (${REPAIR_PASS}): applied ${applied} repair(s) — ${narrowedOrRewritten} rewritten/narrowed, ${deleted} deleted. Unsupported-claim-only targeting; unrelated article content preserved.`);
 }finally{restoreWriterBudget(originalBudget);}
}
main().catch(e=>{const message=e?.message||String(e);if(/No article generated by the current workflow run|grounding repair skipped/i.test(message)){console.log(`Grounding repair: SKIPPED — ${message}`);process.exit(0);}console.error(`Grounding repair failed: ${message}`);process.exit(1)});