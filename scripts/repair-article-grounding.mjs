import fs from 'node:fs';
import { generateWithTrendForgeWriter } from './trendforge-writer-engine.mjs';

const articleDir='content/articles';
const briefPath='data/article-brief.json';
const titleFrom=r=>(r.match(/^title:\s*"([\s\S]*?)"\s*$/m)?.[1]||'').trim();
const descriptionFrom=r=>(r.match(/^description:\s*"([\s\S]*?)"\s*$/m)?.[1]||'').trim();
const parseJson=raw=>{const t=String(raw).trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/i,'');try{return JSON.parse(t)}catch{}const a=t.indexOf('{'),b=t.lastIndexOf('}');if(a>=0&&b>a)return JSON.parse(t.slice(a,b+1));throw new Error('Writer repair output was not valid JSON')};
const latestArticle=()=>{if(!fs.existsSync(articleDir))throw new Error('No article directory');const files=fs.readdirSync(articleDir).filter(f=>f.endsWith('.md')).sort((a,b)=>fs.statSync(`${articleDir}/${b}`).mtimeMs-fs.statSync(`${articleDir}/${a}`).mtimeMs);if(!files.length)throw new Error('No generated article found');return `${articleDir}/${files[0]}`};
const evidenceFromBrief=brief=>(brief?.grounding?.sources||[]).flatMap((s,i)=>(s.passages||[]).map((p,j)=>`[S${i+1}-P${j+1}] ${p}`));

async function main(){
 const articlePath=latestArticle(),raw=fs.readFileSync(articlePath,'utf8');
 const brief=fs.existsSync(briefPath)?JSON.parse(fs.readFileSync(briefPath,'utf8')):null;
 const passages=evidenceFromBrief(brief);
 if(passages.length<6)throw new Error(`Current evidence pack is incomplete: ${passages.length} passages.`);
 const oldTitle=titleFrom(raw),oldDescription=descriptionFrom(raw);
 const oldBody=raw.replace(/^---[\s\S]*?---/,'').replace(/^\s*##\s+Sources[\s\S]*$/i,'').trim().slice(0,14000);
 const evidence=passages.join('\n');
 const prompt=[
  'You are TrendForge strict grounding repair editor.',
  'The previous article failed claim verification. Rewrite it so every material factual statement is directly supported by the publisher evidence below.',
  'Do not use model memory or outside knowledge. Remove unsupported numbers, dates, names, product details, quotes, causal claims, predictions and background facts.',
  'Combine passages only when they clearly describe the same story. Preserve attribution and uncertainty.',
  'Do not copy source sentences verbatim. Produce an original synthesis.',
  'Use 3-6 Markdown H2 headings and roughly 350-600 words. Do not pad.',
  `CURRENT TITLE: ${oldTitle}`,
  `CURRENT DESCRIPTION: ${oldDescription}`,
  `CURRENT DRAFT:\n${oldBody}`,
  `PUBLISHER EVIDENCE PACK:\n${evidence}`,
  'Return ONLY JSON with exactly three string keys: title, description, content.',
  'Keep the same story/topic. Description must be at least 80 characters.'
 ].join('\n\n');
 const out=await generateWithTrendForgeWriter({prompt,category:brief?.brief?.category||process.env.TRENDFORGE_WRITER_CATEGORY||'Technology'});
 const repaired=parseJson(out.text);
 if(!repaired.title?.trim()||!repaired.description?.trim()||!repaired.content?.trim())throw new Error('Repair returned incomplete fields.');
 if(repaired.content.trim().length<900)throw new Error('Repair returned content below safe editorial floor.');
 const frontmatter=raw.match(/^---[\s\S]*?---/)?.[0]||'---\n---';
 const sources=raw.match(/\n\s*##\s+Sources[\s\S]*$/i)?.[0]||'';
 const safeTitle=String(repaired.title).replace(/"/g,'\\"').replace(/\r?\n/g,' ');
 const safeDescription=String(repaired.description).replace(/"/g,'\\"').replace(/\r?\n/g,' ');
 const updatedFrontmatter=frontmatter.replace(/^title:\s*"[\s\S]*?"\s*$/m,`title: "${safeTitle}"`).replace(/^description:\s*"[\s\S]*?"\s*$/m,`description: "${safeDescription}"`).replace(/^publishedAt:\s*"[\s\S]*?"\s*$/m,`publishedAt: "${new Date().toISOString()}"`);
 fs.writeFileSync(articlePath,`${updatedFrontmatter}\n\n${repaired.content.trim()}\n${sources||''}\n`);
 fs.writeFileSync('data/grounding-repair.json',JSON.stringify({generatedAt:new Date().toISOString(),articlePath,provider:out.provider,previousTitle:oldTitle,newTitle:repaired.title,evidencePassages:passages.length,mode:'strict-evidence-repair-v1'},null,2)+'\n');
 console.log(`Grounding repair: rewritten ${articlePath} from ${passages.length} publisher evidence passages using ${out.provider}.`);
}
main().catch(e=>{console.error(`Grounding repair failed: ${e?.message||String(e)}`);process.exit(1)});
