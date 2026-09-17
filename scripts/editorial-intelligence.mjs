import fs from 'node:fs';
import path from 'node:path';

const articleDir='content/articles';
const claimPath='data/claim-verification.json';
const briefPath='data/article-brief.json';
const outputPath='data/editorial-scores.json';
const queuePath='data/editorial-review-queue.json';
const generatedMarkerPath='data/current-article-rejected.json';

const STOP=new Set(['about','after','again','also','been','being','could','from','have','into','more','most','over','said','some','than','that','their','there','these','they','this','what','when','which','with','will','would','your','technology','digital','latest','news','update','guide','today','according','reported']);
const tokenize=(text='')=>new Set(text.toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(w=>w.length>=4&&!STOP.has(w)));
const field=(text,key)=>{const m=text.match(new RegExp(`^${key}:\\s*["']?(.+?)["']?\\s*$`,'mi'));return m?.[1]?.trim()||'';};
const clamp=(n,min=0,max=100)=>Math.max(min,Math.min(max,Math.round(n)));
const sameTitle=(a,b)=>a.trim().toLowerCase()===b.trim().toLowerCase();
const titleOverlap=(a,b)=>{const x=tokenize(a),y=tokenize(b);return [...x].filter(w=>y.has(w)).length;};

if(!fs.existsSync(articleDir)){
  fs.writeFileSync(outputPath,JSON.stringify({version:2,generatedAt:new Date().toISOString(),status:'no_articles',articles:[]},null,2)+'\n');
  fs.writeFileSync(queuePath,JSON.stringify({version:2,generatedAt:new Date().toISOString(),queue:[]},null,2)+'\n');
  console.log('Editorial Intelligence v2: no articles found; skipped.');process.exit(0);
}

const files=fs.readdirSync(articleDir).filter(f=>f.endsWith('.md')).sort();
const articles=files.map(file=>{
  const raw=fs.readFileSync(path.join(articleDir,file),'utf8');
  const parts=raw.split(/^---$/m);const front=parts[1]||'';
  const body=parts.slice(2).join('---').replace(/^\s*##\s+Sources[\s\S]*$/i,'').trim();
  const title=field(front,'title');const description=field(front,'description');const category=field(front,'category');const slug=field(front,'slug')||file.replace(/\.md$/,'');
  const words=body.split(/\s+/).filter(Boolean).length;const headings=(body.match(/^##\s+.+$/gm)||[]).length;
  const paragraphs=body.split(/\n\s*\n/).map(x=>x.replace(/^##\s+.+\n?/,'').trim()).filter(x=>x.length>=80);
  const sourceUrls=[...raw.matchAll(/\]\((https:\/\/[^)]+)\)/g)].map(m=>m[1]);
  const uniqueSourceDomains=new Set(sourceUrls.map(u=>{try{return new URL(u).hostname.replace(/^www\./,'')}catch{return u}}));
  const publishedAt=field(front,'publishedAt');
  return{file,slug,title,description,category,body,words,headings,paragraphs,sourceUrls,uniqueSourceDomains:[...uniqueSourceDomains],publishedAt};
});

function originalityScore(article,index){
  const own=tokenize(article.title);const others=articles.filter((_,i)=>i!==index).map(a=>tokenize(a.title));
  const maxOverlap=others.length?Math.max(...others.map(t=>[...own].filter(w=>t.has(w)).length/Math.max(1,own.size))):0;
  return clamp(100-maxOverlap*100);
}
function clarityScore(a){
  const sentences=a.paragraphs.join(' ').split(/(?<=[.!?])\s+/).filter(Boolean);
  const avg=sentences.length?sentences.reduce((n,s)=>n+s.split(/\s+/).length,0)/sentences.length:0;
  const structure=Math.min(100,(a.headings/5)*70+(a.paragraphs.length/6)*30);
  const sentence=avg>=12&&avg<=32?100:avg>=8&&avg<=40?80:55;
  return clamp(structure*.55+sentence*.45);
}
function usefulnessScore(a){
  const actionable=/\b(what to watch|how to|steps?|check|consider|look for|use|avoid|should|can help|takeaway|practical|next)\b/i.test(a.body)?100:72;
  const explanatory=/\b(why|because|means|impact|risk|benefit|example|explains|context)\b/i.test(a.body)?100:70;
  const depth=a.words>=700?100:a.words>=450?90:a.words>=300?82:a.words>=200?70:55;
  return clamp(actionable*.35+explanatory*.35+depth*.30);
}
function sourceStrength(a,claim){
  const diversity=clamp(a.uniqueSourceDomains.length*45);const count=clamp(a.sourceUrls.length*35);const confidence=claim?.averageConfidence??0;
  return clamp(diversity*.3+count*.2+confidence*.5);
}
function evidenceScore(a,claim){
  if(!claim)return a.sourceUrls.length>=2?75:50;
  if(claim.claimCount===0)return 70;
  return clamp((claim.averageConfidence||0)*.75+(claim.verified||0)/Math.max(1,claim.claimCount)*25);
}

let claim=null;try{if(fs.existsSync(claimPath))claim=JSON.parse(fs.readFileSync(claimPath,'utf8'));}catch{claim=null;}
let brief=null;try{if(fs.existsSync(briefPath))brief=JSON.parse(fs.readFileSync(briefPath,'utf8'));}catch{brief=null;}
const briefTitle=String(brief?.brief?.title||'').trim();
const generatedSlug=String(brief?.brief?.slug||brief?.slug||'').trim();
const rejectedMarker=fs.existsSync(generatedMarkerPath);

// Current-run identity must come from the run brief, not alphabetical filename order
// or a loose two-token title match. Slug is strongest; exact title is next; only then
// use a conservative title overlap, and require the article to be the newest published
// artifact. This prevents an old article from silently becoming the current article.
let current=null;
if(!rejectedMarker&&articles.length){
  if(generatedSlug)current=articles.find(a=>sameTitle(a.slug,generatedSlug))||null;
  if(!current&&briefTitle)current=articles.find(a=>sameTitle(a.title,briefTitle))||null;
  if(!current&&briefTitle){
    const matches=articles.map(a=>({a,overlap:titleOverlap(a.title,briefTitle)})).filter(x=>x.overlap>=3).sort((a,b)=>b.overlap-a.overlap||String(b.a.publishedAt).localeCompare(String(a.a.publishedAt)));
    if(matches.length===1)current=matches[0].a;
  }
}

const scored=articles.map((a,i)=>{
  const isCurrent=Boolean(current&&a.slug===current.slug);
  const evidence=evidenceScore(a,isCurrent?claim:null);const usefulness=usefulnessScore(a);const clarity=clarityScore(a);const originality=originalityScore(a,i);const source=sourceStrength(a,isCurrent?claim:null);
  const score=clamp(evidence*.25+usefulness*.20+clarity*.20+originality*.15+source*.20);
  const decision=score>=90?'publish_candidate':score>=80?'publish_ready':score>=65?'review':'rewrite_or_reject';
  const reasons=[];if(evidence<80)reasons.push('evidence confidence needs improvement');if(usefulness<80)reasons.push('reader usefulness/actionability is limited');if(clarity<80)reasons.push('structure/readability needs improvement');if(originality<80)reasons.push('topic/title similarity is high');if(source<80)reasons.push('source strength/diversity needs improvement');
  return{slug:a.slug,title:a.title,category:a.category,score,decision,dimensions:{evidence,usefulness,clarity,originality,sourceStrength:source},reasons};
});

const currentScore=current?scored.find(x=>x.slug===current.slug):null;
const pass=!current||currentScore?.score>=80;
const queue=scored.filter(x=>x.decision==='review'||x.decision==='rewrite_or_reject').sort((a,b)=>b.score-a.score).slice(0,100);
const result={version:2,generatedAt:new Date().toISOString(),status:pass?'pass':'block',currentGeneratedArticle:current?.slug||null,currentScore:currentScore?.score??null,identity:{method:generatedSlug?'brief.slug':briefTitle?'brief.title':'conservative.title.match',rejectedMarker},policy:{publishCandidate:90,publishReady:80,review:65,rewriteOrRejectBelow:65},articles:scored};
fs.writeFileSync(outputPath,JSON.stringify(result,null,2)+'\n');fs.writeFileSync(queuePath,JSON.stringify({version:2,generatedAt:new Date().toISOString(),queue},null,2)+'\n');
console.log(`Editorial Intelligence v2: ${articles.length} article(s) scored.`);
console.log(`Editorial summary: ${scored.filter(x=>x.decision==='publish_candidate').length} publish candidate(s), ${scored.filter(x=>x.decision==='publish_ready').length} publish-ready, ${scored.filter(x=>x.decision==='review').length} review, ${scored.filter(x=>x.decision==='rewrite_or_reject').length} rewrite/reject.`);
if(current)console.log(`Current generated article: ${current.slug} — ${currentScore?.score??0}/100 — ${currentScore?.decision||'unknown'}${currentScore?.reasons?.length?` — ${currentScore.reasons.join('; ')}`:''}`);else console.log('No deterministically matching generated article for current brief; editorial gate skipped safely.');
if(!pass){console.error(`Editorial Intelligence BLOCK: current generated article scored ${currentScore.score}/100 (<80).`);process.exit(1);}
