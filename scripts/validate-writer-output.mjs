import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { validateDraft } from './trendforge-editorial-policy.mjs';

const parseFrontmatter=(raw)=>{
  const match=raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if(!match)return {meta:{},body:raw};
  const meta={};
  for(const line of match[1].split('\n')){
    const m=line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*["']?(.+?)["']?$/);
    if(m)meta[m[1]]=m[2];
  }
  return {meta,body:match[2]};
};

const proseOnly=(body='')=>body.replace(/\n##\s+Sources[\s\S]*$/i,'').trim();
let canonicalBlueprint=null,currentRun=null;
try{const brief=JSON.parse(fs.readFileSync('data/article-brief.json','utf8'));canonicalBlueprint=brief?.blueprint||null;currentRun=JSON.parse(fs.readFileSync('data/current-run-article.json','utf8'));}catch{}

let status='';
try{status=execFileSync('git',['status','--short','content/articles'],{encoding:'utf8'});}catch(error){console.error(`Writer output gate could not inspect git status: ${error.message}`);process.exit(1);}
const files=status.split('\n').map(x=>x.trim()).filter(x=>/^(\?\?|[AM])\s+content\/articles\/[^ ]+\.md$/.test(x)).map(x=>x.replace(/^(\?\?|[AM])\s+/,'')).filter((v,i,a)=>a.indexOf(v)===i).filter(file=>!currentRun?.generated||currentRun.articlePath===file);

if(files.length===0){console.log('Writer output gate: no newly generated article detected; skipped safely.');process.exit(0);}
let failed=false;
for(const file of files){
  const raw=fs.readFileSync(file,'utf8');
  const {meta,body}=parseFrontmatter(raw);
  const title=meta.title||'';
  const description=meta.description||'';
  const category=meta.category||'Technology';
  const content=proseOnly(body);
  const report=validateDraft({title,description,content,category,blueprint:canonicalBlueprint});
  console.log(`Writer output gate: ${file} — ${report.passed?'PASS':'BLOCK'} — ${report.metrics.words} prose words, ${report.metrics.h2} prose H2, ${report.metrics.fillerHits} filler hits.`);
  if(!report.passed){failed=true;console.error(`Writer output gate reasons: ${report.errors.join('; ')}`);}
}

if(failed){
  console.error('Writer output gate BLOCKED publication-quality prose.');
  process.exit(1);
}
console.log('Writer output gate: PASS');
