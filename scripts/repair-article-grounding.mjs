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
 const failed=claims.filter(x=>x.status!=='verified'&&x.status!=='editorial-excluded'&&x.evidence).slice(0,12).map(x=>`CLAIM: ${x.claim}\nSTATUS: ${x.status}\nEVIDENCE: ${String(x.evidence).slice(0,2200)}\nSOURCE: ${x.bestSource||''}`).join('\n\n');
 const fallback=briefPassages(brief).sort((a,b)=>b.text.length-a.text.length).slice(0,18).map(x=>`[${x.source}] ${x.text.slice(0,1800)}`).join('\n\n');
 return [failed,fallback].filter(Boolean).join('\n\n').slice(0,30000);
};

async function main(){
 const articlePath=latestArticle(),raw=fs.readFileSync(articlePath,'utf8');
 const brief=fs.existsSync(briefPath)?JSON.parse(fs.readFileSync(briefPath,'utf8')):null;
 const verification=fs.existsSync(claimPath)?JSON.parse(fs.readFileSync(claimPath,'utf8')):null;
 const claims=Array.isArray(verification?.claims)?verification.claims:Array.isArray(verification?.results)?verification.results:[];
 const failed=claims.filter(x=>x.status!=='verified'&&x.status!=='editorial-excluded');
 if(!failed.length){console.log('Grounding repair: no failed factual claims; article left unchanged.');return;}
 const evidence=compactEvidence(brief,claims);
 if(!evidence||evidence.length<500)throw new Error('Current claim evidence is incomplete; grounding repair refused.');
 const oldTitle=titleFrom(raw),oldDescription=descriptionFrom(raw);
 const oldBody=raw.replace(/^---[\s\S]*?---/,'').replace(/\n\s*##\s+Sources[\s\S]*$/i,'').trim();
 const failedClaims=failed.slice(0,12).map((x,i)=>`FAILED CLAIM ${i+1} [${x.status}, confidence ${x.confidence??0}]: ${x.claim}\nBEST EVIDENCE: ${String(x.evidence||'').slice(0,2200)}\nSOURCE: ${x.bestSource||''}\nURL: ${x.bestUrl||''}`).join('\n\n');
 const prompt=[
  'You are TrendForge strict grounding repair editor. Perform a SURGICAL, CLAIM-PRESERVING repair of the SAME article.',
  'The article already passed the Writer output gate. Do NOT rewrite the whole story. Preserve every existing sentence, paragraph, heading, title, and supported factual detail unless a specific failed claim requires a minimal edit.',
  'SOURCE OF TRUTH RULE: supplied publisher evidence is the ONLY factual source. Never use model memory, general knowledge, inference, assumptions, or unsupported context.',
  'REPAIR RULE: edit only the sentence(s) containing a failed factual claim. If the evidence supports a narrower version, narrow/rephrase that sentence. If no supported version exists, delete that sentence. Do not replace it with a new unrelated fact.',
  'CLAIM-PRESERVATION RULE: never remove or rewrite unrelated verified claims merely to make verification easier. Preserve supported numbers, dates, names, attributed statements and useful detail exactly in substance.',
  'Do not invent or preserve unsupported numbers, dates, names, quotes, product specifications, percentages, causes, motives, forecasts, market effects, or availability claims.',
  'Attribution must remain explicit when evidence is attributed. Do not convert “the company said” into an objective fact.',
  'Editorial analysis/recommendations may remain only if they introduce no new factual premise. Do not relabel unsupported facts as editorial language.',
  'Keep the same story and roughly the same length. Do not pad. Do not aggressively shorten a healthy article.',
  'Return ONLY JSON with exactly three string keys: title, description, content. Keep title and description unchanged unless the failed claim is in one of them.',
  `CURRENT TITLE: ${oldTitle}`,
  `CURRENT DESCRIPTION: ${oldDescription}`,
  `CURRENT ARTICLE:\n${oldBody.slice(0,14000)}`,
  `FAILED CLAIMS THAT REQUIRE REPAIR:\n${failedClaims}`,
  `PUBLISHER EVIDENCE — ONLY FACTUAL SOURCE:\n${evidence}`,
  'Before producing JSON, internally map each failed claim to its evidence. Make the smallest possible edit for each failed claim. Then verify that previously supported material remains present and no new factual premise was introduced.'
 ].join('\n\n');
 let out;
 try{out=await generateWithTrendForgeWriter({prompt,category:brief?.brief?.category||process.env.TRENDFORGE_WRITER_CATEGORY||'Technology',expectedTitle:oldTitle});}
 catch(e){throw new Error(`Grounding repair provider failed: ${e?.message||String(e)}`)}
 const repaired=parseJson(out.text);
 if(!repaired.title?.trim()||!repaired.description?.trim()||!repaired.content?.trim())throw new Error('Repair returned incomplete fields.');
 if(repaired.content.trim().length<900)throw new Error('Repair returned content below safe editorial floor.');
 const frontmatter=raw.match(/^---[\s\S]*?---/)?.[0]||'---\n---';
 const sources=raw.match(/\n\s*##\s+Sources[\s\S]*$/i)?.[0]||'';
 const safeTitle=String(repaired.title).replace(/"/g,'\\"').replace(/\r?\n/g,' ');
 const safeDescription=String(repaired.description).replace(/"/g,'\\"').replace(/\r?\n/g,' ');
 const updatedFrontmatter=frontmatter.replace(/^title:\s*"[\s\S]*?"\s*$/m,`title: "${safeTitle}"`).replace(/^description:\s*"[\s\S]*?"\s*$/m,`description: "${safeDescription}"`).replace(/^publishedAt:\s*"[\s\S]*?"\s*$/m,`publishedAt: "${new Date().toISOString()}"`);
 fs.writeFileSync(articlePath,`${updatedFrontmatter}\n\n${repaired.content.trim()}\n${sources||''}\n`);
 fs.writeFileSync('data/grounding-repair.json',JSON.stringify({generatedAt:new Date().toISOString(),articlePath,provider:out.provider,previousTitle:oldTitle,newTitle:repaired.title,evidenceClaims:claims.length,failedClaims:failed.length,evidenceChars:evidence.length,mode:'claim-preserving-surgical-repair-v5',providerAttempts:1},null,2)+'\n');
 console.log(`Grounding repair v5: surgically repaired ${failed.length} failed claim(s) without broad article rewriting using ${out.provider}.`);
}
main().catch(e=>{console.error(`Grounding repair failed: ${e?.message||String(e)}`);process.exit(1)});
