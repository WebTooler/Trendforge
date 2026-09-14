import fs from 'node:fs';
import path from 'node:path';

const articleDir = 'content/articles';
const claimPath = 'data/claim-verification.json';
const briefPath = 'data/article-brief.json';
const outputPath = 'data/editorial-scores.json';
const queuePath = 'data/editorial-review-queue.json';

const STOP = new Set(['about','after','again','also','been','being','could','from','have','into','more','most','over','said','some','than','that','their','there','these','they','this','what','when','which','with','will','would','your','technology','digital','latest','news','update','guide','today','according','reported']);
const tokenize = (text='') => new Set(text.toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(w => w.length >= 4 && !STOP.has(w)));
const field = (text,key) => { const m=text.match(new RegExp(`^${key}:\\s*["']?(.+?)["']?\\s*$`,'mi')); return m?.[1]?.trim() || ''; };
const normalize = (text='') => text.toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
const clamp = (n,min=0,max=100) => Math.max(min,Math.min(max,Math.round(n)));

if (!fs.existsSync(articleDir)) {
  fs.writeFileSync(outputPath, JSON.stringify({version:1,generatedAt:new Date().toISOString(),status:'no_articles',articles:[]},null,2)+'\n');
  fs.writeFileSync(queuePath, JSON.stringify({version:1,generatedAt:new Date().toISOString(),queue:[]},null,2)+'\n');
  console.log('Editorial Intelligence v1: no articles found; skipped.');
  process.exit(0);
}

const files = fs.readdirSync(articleDir).filter(f=>f.endsWith('.md')).sort();
const articles = files.map(file => {
  const raw=fs.readFileSync(path.join(articleDir,file),'utf8');
  const parts=raw.split(/^---$/m);
  const front=parts[1]||'';
  const body=parts.slice(2).join('---').replace(/^\s*##\s+Sources[\s\S]*$/i,'').trim();
  const title=field(front,'title');
  const description=field(front,'description');
  const category=field(front,'category');
  const slug=field(front,'slug')||file.replace(/\.md$/,'');
  const words=body.split(/\s+/).filter(Boolean).length;
  const headings=(body.match(/^##\s+.+$/gm)||[]).length;
  const paragraphs=body.split(/\n\s*\n/).map(x=>x.replace(/^##\s+.+\n?/,'').trim()).filter(x=>x.length>=80);
  const sourceUrls=[...raw.matchAll(/\]\((https:\/\/[^)]+)\)/g)].map(m=>m[1]);
  const uniqueSourceDomains=new Set(sourceUrls.map(u=>{try{return new URL(u).hostname.replace(/^www\./,'')}catch{return u}}));
  return {file,slug,title,description,category,body,words,headings,paragraphs,sourceUrls,uniqueSourceDomains:[...uniqueSourceDomains]};
});

const allTitleTokens=articles.map(a=>tokenize(a.title));
function originalityScore(article,index){
  const own=allTitleTokens[index];
  const otherTitles=allTitleTokens.filter((_,i)=>i!==index);
  const maxOverlap=otherTitles.length ? Math.max(...otherTitles.map(t=>[...own].filter(w=>t.has(w)).length/(Math.max(1,own.size)))) : 0;
  return clamp(100-maxOverlap*100);
}
function clarityScore(a){
  const avgSentence = a.paragraphs.length ? a.paragraphs.join(' ').split(/(?<=[.!?])\s+/).filter(Boolean).reduce((n,s)=>n+s.split(/\s+/).length,0)/Math.max(1,a.paragraphs.join(' ').split(/(?<=[.!?])\s+/).filter(Boolean).length) : 0;
  const structure = Math.min(100,(a.headings/5)*70 + (a.paragraphs.length/6)*30);
  const sentence = avgSentence>=12 && avgSentence<=32 ? 100 : avgSentence>=8 && avgSentence<=40 ? 80 : 55;
  return clamp(structure*0.55+sentence*0.45);
}
function usefulnessScore(a){
  const actionable=/\b(what to watch|how to|steps?|check|consider|look for|use|avoid|should|can help|takeaway|practical|next)\b/i.test(a.body) ? 100 : 72;
  const explanatory=/\b(why|because|means|impact|risk|benefit|example|explains|context)\b/i.test(a.body) ? 100 : 70;
  const depth=a.words>=700?100:a.words>=450?90:a.words>=300?82:a.words>=200?70:55;
  return clamp(actionable*0.35+explanatory*0.35+depth*0.30);
}
function sourceStrength(a, claim){
  const diversity=clamp(a.uniqueSourceDomains.length*45);
  const count=clamp(a.sourceUrls.length*35);
  const confidence=claim?.averageConfidence ?? 0;
  const claimSignal=claim?.status==='skipped_no_matching_generated_article' ? 75 : confidence;
  return clamp(diversity*0.3+count*0.2+claimSignal*0.5);
}
function evidenceScore(a, claim){
  if (!claim) return a.sourceUrls.length>=2 ? 75 : 50;
  if (claim.status==='skipped_no_matching_generated_article') return 75;
  if (claim.claimCount===0) return 70;
  return clamp((claim.averageConfidence||0)*0.75 + (claim.verified||0)/Math.max(1,claim.claimCount)*25);
}

let claim=null;
if(fs.existsSync(claimPath)){try{claim=JSON.parse(fs.readFileSync(claimPath,'utf8'));}catch{claim=null;}}
let brief=null;
if(fs.existsSync(briefPath)){try{brief=JSON.parse(fs.readFileSync(briefPath,'utf8'));}catch{brief=null;}}
const briefTitle=brief?.brief?.title?.trim()||'';
const latest=articles[articles.length-1];
const currentIsGenerated = Boolean(latest && briefTitle && [...tokenize(latest.title)].filter(w=>tokenize(briefTitle).has(w)).length>=2);

const scored=articles.map((a,i)=>{
  const evidence=evidenceScore(a,currentIsGenerated && a.slug===latest.slug ? claim : null);
  const usefulness=usefulnessScore(a);
  const clarity=clarityScore(a);
  const originality=originalityScore(a,i);
  const source=sourceStrength(a,currentIsGenerated && a.slug===latest.slug ? claim : null);
  const score=clamp(evidence*0.25+usefulness*0.20+clarity*0.20+originality*0.15+source*0.20);
  const decision=score>=90?'publish_candidate':score>=80?'publish_ready':score>=65?'review':'rewrite_or_reject';
  const reasons=[];
  if(evidence<80) reasons.push('evidence confidence needs improvement');
  if(usefulness<80) reasons.push('reader usefulness/actionability is limited');
  if(clarity<80) reasons.push('structure/readability needs improvement');
  if(originality<80) reasons.push('topic/title similarity is high');
  if(source<80) reasons.push('source strength/diversity needs improvement');
  return {slug:a.slug,title:a.title,category:a.category,score,decision,dimensions:{evidence,usefulness,clarity,originality,sourceStrength:source},reasons};
});

const current = currentIsGenerated ? scored.find(x=>x.slug===latest.slug) : null;
const pass = !current || current.score>=80;
const queue=scored.filter(x=>x.decision==='review'||x.decision==='rewrite_or_reject').sort((a,b)=>b.score-a.score).slice(0,100);
const result={version:1,generatedAt:new Date().toISOString(),status:pass?'pass':'block',currentGeneratedArticle:current?.slug||null,currentScore:current?.score??null,policy:{publishCandidate:90,publishReady:80,review:65,rewriteOrRejectBelow:65},articles:scored};
fs.writeFileSync(outputPath,JSON.stringify(result,null,2)+'\n');
fs.writeFileSync(queuePath,JSON.stringify({version:1,generatedAt:new Date().toISOString(),queue},null,2)+'\n');
console.log(`Editorial Intelligence v1: ${articles.length} article(s) scored.`);
console.log(`Editorial summary: ${scored.filter(x=>x.decision==='publish_candidate').length} publish candidate(s), ${scored.filter(x=>x.decision==='publish_ready').length} publish-ready, ${scored.filter(x=>x.decision==='review').length} review, ${scored.filter(x=>x.decision==='rewrite_or_reject').length} rewrite/reject.`);
if(current) console.log(`Current generated article: ${current.slug} — ${current.score}/100 — ${current.decision}${current.reasons.length?` — ${current.reasons.join('; ')}`:''}`);
else console.log('No matching generated article for current brief; editorial gate skipped safely.');
if(!pass){console.error(`Editorial Intelligence BLOCK: current generated article scored ${current.score}/100 (<80).`);process.exit(1);}
