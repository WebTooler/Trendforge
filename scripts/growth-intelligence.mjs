import fs from 'node:fs';

const articlesDir='content/articles';
const lifecyclePath='data/article-lifecycle.json';
const editorialPath='data/editorial-scores.json';
const outputPath='data/growth-intelligence.json';
const categories=['AI','Technology','How-To','Innovation','Product Launches','Digital Life','Crypto'];

const front=(raw,key)=>raw.match(new RegExp(`^${key}:\\s*[\"']?(.+?)[\"']?\\s*$`,'mi'))?.[1]?.trim()||'';
const normalize=(s='')=>s.toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
const files=fs.existsSync(articlesDir)?fs.readdirSync(articlesDir).filter(f=>f.endsWith('.md')):[];
const articles=files.map(file=>{const raw=fs.readFileSync(`${articlesDir}/${file}`,'utf8');return {file,title:front(raw,'title')||file,category:front(raw,'category')||'Technology',description:front(raw,'description'),publishedAt:front(raw,'publishedAt')};});
const counts=Object.fromEntries(categories.map(c=>[c,0]));
for(const a of articles)if(counts[a.category]!==undefined)counts[a.category]++;
const total=Math.max(1,articles.length);
const categoryMix=categories.map(category=>({category,count:counts[category],share:Math.round(counts[category]/total*1000)/10}));
const missing=categories.filter(c=>counts[c]===0);
const overrepresented=categoryMix.filter(x=>x.share>35).map(x=>x.category);

let editorial=null;try{editorial=JSON.parse(fs.readFileSync(editorialPath,'utf8'));}catch{}
let lifecycle=null;try{lifecycle=JSON.parse(fs.readFileSync(lifecyclePath,'utf8'));}catch{}
const editorialArticles=Array.isArray(editorial?.articles)?editorial.articles:[];
const avgEditorial=editorialArticles.length?Math.round(editorialArticles.reduce((s,a)=>s+(a.score||0),0)/editorialArticles.length):null;
const reviewCount=editorialArticles.filter(a=>a.decision==='review').length;
const refreshCount=lifecycle?.summary?.refreshCandidates??0;

const recommendations=[];
if(missing.length)recommendations.push(`Prioritize missing categories: ${missing.join(', ')}.`);
if(overrepresented.length)recommendations.push(`Reduce short-term concentration in: ${overrepresented.join(', ')}.`);
if(reviewCount)recommendations.push(`${reviewCount} article(s) are in editorial review; improve them before treating them as growth winners.`);
if(refreshCount)recommendations.push(`${refreshCount} older/incomplete article(s) are refresh candidates.`);
if(!recommendations.length)recommendations.push('Category mix is balanced; continue prioritizing high-confidence, novel topics.');

const result={version:1,generatedAt:new Date().toISOString(),policy:{privacyFirst:true,noPersonalTracking:true,noPaidTrafficRequired:true},summary:{totalArticles:articles.length,averageEditorialScore:avgEditorial,editorialReviewCount:reviewCount,refreshCandidates:refreshCount},categoryMix,missingCategories:missing,overrepresentedCategories:overrepresented,recommendations,recentArticles:articles.sort((a,b)=>(Date.parse(b.publishedAt)||0)-(Date.parse(a.publishedAt)||0)).slice(0,10).map(a=>({title:a.title,category:a.category,publishedAt:a.publishedAt}))};
fs.mkdirSync('data',{recursive:true});
fs.writeFileSync(outputPath,JSON.stringify(result,null,2));
console.log(`Growth Intelligence v1: ${articles.length} article(s), avg editorial score ${avgEditorial??'n/a'}, ${missing.length} missing categor${missing.length===1?'y':'ies'}.`);
