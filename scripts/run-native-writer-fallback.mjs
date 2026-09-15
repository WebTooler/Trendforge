import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { available } from './ai-provider-router.mjs';
import { articleToMarkdown, editorialGate, slugify } from '../lib/article-engine.ts';
import { copyrightSafetyGate } from '../lib/copyright-safety.ts';

const input='data/scored-trends.json';
const verificationInput='data/source-verification.json';
const outputDir='content/articles';
const marker='data/native-writer-published.json';
const workerInput='data/native-writer-worker-input.json';
const workerOutput='data/native-writer-worker-output.json';
const CANDIDATE_BUDGET_MS=12000;
const TOTAL_BUDGET_MS=90000;
const MAX_CANDIDATES=12;
const startedAt=Date.now();
const workerCommand=process.platform==='win32'?'node_modules/.bin/tsx.cmd':'node_modules/.bin/tsx';

if(fs.existsSync(marker))fs.rmSync(marker);
if(available.length>0){console.log(`Native fallback: ${available.length} AI provider(s) available; normal Writer Engine remains authoritative.`);process.exit(0);}
if(!fs.existsSync(input)){console.log('Native fallback: no scored trends available.');process.exit(0);}

const payload=JSON.parse(fs.readFileSync(input,'utf8'));
const verification=fs.existsSync(verificationInput)?JSON.parse(fs.readFileSync(verificationInput,'utf8')):{records:[]};
const verifiedByLink=new Map((verification.records??[]).map(r=>[r.link,r]));
const trends=(payload.trends??[]).map(item=>{const record=verifiedByLink.get(item.link);return record?.sources?.length?{...item,sources:record.sources.filter(s=>s.ok&&s.url)}:item;});
const existingTitles=new Set();
if(fs.existsSync(outputDir))for(const file of fs.readdirSync(outputDir).filter(n=>n.endsWith('.md'))){const raw=fs.readFileSync(`${outputDir}/${file}`,'utf8');const title=raw.match(/^title:\s*"([\s\S]*?)"\s*$/m)?.[1];if(title)existingTitles.add(title.toLowerCase().trim());}
const ranked=trends.filter(x=>x?.eligible&&!existingTitles.has(String(x.title||'').toLowerCase().trim())).sort((a,b)=>(b.decisionScore??b.score??0)-(a.decisionScore??a.score??0));
console.log(`Native fallback: all providers unavailable; testing ${Math.min(ranked.length,MAX_CANDIDATES)} isolated evidence-backed candidate(s).`);
console.log(`Native fallback runtime guard: ${CANDIDATE_BUDGET_MS}ms/candidate, ${TOTAL_BUDGET_MS}ms total, hard subprocess kill.`);
console.log('Native Writer v2.4: publisher-feed recovery, story-title isolation, 450-word minimum; no padding.');

for(const candidate of ranked.slice(0,MAX_CANDIDATES)){
  const elapsed=Date.now()-startedAt;if(elapsed>=TOTAL_BUDGET_MS){console.log(`Native fallback stopped: total runtime budget reached (${TOTAL_BUDGET_MS}ms).`);break;}
  if(fs.existsSync(workerOutput))fs.rmSync(workerOutput);
  fs.writeFileSync(workerInput,JSON.stringify({candidate,existingTitles:[...existingTitles]}));
  const timeout=Math.min(CANDIDATE_BUDGET_MS,TOTAL_BUDGET_MS-elapsed);
  try{
    execFileSync(workerCommand,['scripts/native-writer-worker.mjs'],{stdio:'inherit',env:process.env,timeout,killSignal:'SIGKILL'});
  }catch(error){
    if(error?.killed||error?.signal==='SIGKILL'||error?.code==='ETIMEDOUT')console.log(`Native fallback timed out hard: ${candidate.category} — ${candidate.title} — ${timeout}ms.`);
    else console.log(`Native fallback worker failed: ${candidate.category} — ${candidate.title} — ${error?.message||String(error)}`);
    continue;
  }
  if(!fs.existsSync(workerOutput)){console.log(`Native fallback worker produced no result: ${candidate.title}`);continue;}
  let result;try{result=JSON.parse(fs.readFileSync(workerOutput,'utf8'));}catch{console.log(`Native fallback worker returned invalid result: ${candidate.title}`);continue;}
  if(!result?.ok){console.log(`Native fallback skipped: ${candidate.category} — ${candidate.title} — ${result?.reason||'writer rejected candidate'}`);continue;}
  const article={...result.article,slug:slugify(result.article.title),generatedAt:new Date().toISOString(),author:'Tejendra Pal Singh'};
  const editorial=editorialGate(article);
  const copyright=copyrightSafetyGate({content:article.content,sources:article.sources.map(s=>s.url),sourceTexts:article.sourceTexts,images:[]});
  if(!editorial.passed||!copyright.passed){console.log(`Native fallback rejected by downstream gates: ${candidate.title}`);console.log(`Native fallback gate detail: editorial=${editorial.passed?'PASS':'FAIL'} copyright=${copyright.passed?'PASS':'FAIL'}`);continue;}
  fs.mkdirSync(outputDir,{recursive:true});fs.writeFileSync(`${outputDir}/${article.slug}.md`,articleToMarkdown(article));fs.mkdirSync('data',{recursive:true});
  fs.writeFileSync(marker,JSON.stringify({version:'2.4',generatedAt:new Date().toISOString(),candidate:{title:candidate.title,category:candidate.category,link:candidate.link},diagnostics:result.diagnostics,editorial,copyright},null,2)+'\n');
  console.log(`Native fallback published: ${article.slug}`);process.exit(0);
}
if(fs.existsSync(workerInput))fs.rmSync(workerInput);
if(fs.existsSync(workerOutput))fs.rmSync(workerOutput);
console.log(`Native fallback: no candidate had enough isolated, topic-relevant evidence within the ${TOTAL_BUDGET_MS}ms runtime budget.`);
process.exit(0);
