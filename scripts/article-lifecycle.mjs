import fs from 'node:fs';

const articlesDir = 'content/articles';
const outputPath = 'data/article-lifecycle.json';
const now = Date.now();
const DAY = 24 * 60 * 60 * 1000;

const parseFrontmatter = (raw, key) => raw.match(new RegExp(`^${key}:\\s*[\"']?(.+?)[\"']?\\s*$`, 'mi'))?.[1]?.trim() || '';
const normalize = (s='') => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
const tokens = (s='') => new Set(normalize(s).split(' ').filter(w => w.length >= 5));
const overlap = (a,b) => { const x=tokens(a), y=tokens(b); if(!x.size||!y.size)return 0; let n=0; for(const w of x)if(y.has(w))n++; return n/Math.max(x.size,y.size); };

const classifyAge = ageDays => ageDays >= 30 ? 'stale' : ageDays >= 14 ? 'aging' : ageDays >= 7 ? 'watch' : 'fresh';
const classifyAction = (refreshScore, ageDays, words, sourceCount) => {
  if (refreshScore >= 75) return ageDays >= 30 ? 'refresh-now' : 'refresh-review';
  if (refreshScore >= 45) return words < 450 || sourceCount < 1 ? 'review-completeness' : 'watch';
  return 'no-action';
};

if (!fs.existsSync(articlesDir)) {
  fs.mkdirSync('data',{recursive:true});
  fs.writeFileSync(outputPath, JSON.stringify({version:2,generatedAt:new Date().toISOString(),articles:[],refreshQueue:[],clusters:[]},null,2)+'\n');
  console.log('Article Lifecycle v2: no articles found.');
  process.exit(0);
}

const files=fs.readdirSync(articlesDir).filter(f=>f.endsWith('.md'));
const articles=files.map(file=>{
  const raw=fs.readFileSync(`${articlesDir}/${file}`,'utf8');
  const title=parseFrontmatter(raw,'title') || file.replace(/\.md$/,'');
  const category=parseFrontmatter(raw,'category') || 'Technology';
  const publishedAt=parseFrontmatter(raw,'publishedAt');
  const publishedMs=Date.parse(publishedAt)||0;
  const ageDays=publishedMs ? Math.max(0,(now-publishedMs)/DAY) : 999;
  const body=raw.split(/^---$/m).slice(2).join('---').replace(/^\s*##\s+Sources[\s\S]*$/i,'').trim();
  const words=body.split(/\s+/).filter(Boolean).length;
  const sourceCount=(raw.match(/https:\/\/[^)\s]+/g)||[]).length;
  const staleness=ageDays>=30?100:ageDays>=14?75:ageDays>=7?45:10;
  const completeness= Math.min(100, (words>=700?45:words>=450?35:words>=250?25:15) + (sourceCount>=2?35:sourceCount===1?20:0) + (parseFrontmatter(raw,'description').length>=100?20:10));
  const refreshScore=Math.round(staleness*0.55+completeness*0.45);
  const ageState=classifyAge(ageDays);
  const status=refreshScore>=75?'refresh_candidate':refreshScore>=45?'watch':'fresh';
  const action=classifyAction(refreshScore, ageDays, words, sourceCount);
  const reasons=[];
  if(ageDays>=30) reasons.push('older than 30 days');
  else if(ageDays>=14) reasons.push('older than 14 days');
  else if(ageDays>=7) reasons.push('older than 7 days');
  if(words<450) reasons.push('content below 450 words');
  if(sourceCount<1) reasons.push('no source URL detected');
  if(parseFrontmatter(raw,'description').length<100) reasons.push('short description');
  return {file,title,category,publishedAt,ageDays:Math.round(ageDays*10)/10,ageState,words,sourceCount,refreshScore,status,action,reasons};
});

articles.sort((a,b)=>b.refreshScore-a.refreshScore);
const refreshQueue=articles.filter(a=>a.status==='refresh_candidate').slice(0,50).map((a,index)=>({...a,priority:index+1}));
const watchQueue=articles.filter(a=>a.status==='watch').slice(0,50).map((a,index)=>({...a,priority:index+1}));

// Detect title clusters so lifecycle refreshes can be merged instead of creating near-duplicates.
const clusters=[];
for(const article of articles){
  const match=clusters.find(c=>overlap(article.title,c.title)>=0.65);
  if(match){ match.members.push(article.title); match.files.push(article.file); }
  else clusters.push({title:article.title,members:[article.title],files:[article.file]});
}
const duplicateClusters=clusters.filter(c=>c.members.length>1).map(c=>({...c,similarityThreshold:0.65}));

const result={
  version:2,
  generatedAt:new Date().toISOString(),
  policy:{
    refreshCandidateScore:75,
    watchScore:45,
    maxQueueSize:50,
    doesNotAutoRewrite:true,
    doesNotDeleteArticles:true,
    duplicateDetectionOnly:true,
    preservesPublicationGates:true
  },
  summary:{
    articles:articles.length,
    refreshCandidates:refreshQueue.length,
    watch:watchQueue.length,
    fresh:articles.filter(a=>a.status==='fresh').length,
    stale:articles.filter(a=>a.ageState==='stale').length,
    duplicateClusters:duplicateClusters.length
  },
  articles,
  refreshQueue,
  watchQueue,
  duplicateClusters
};
fs.mkdirSync('data',{recursive:true});
fs.writeFileSync(outputPath,JSON.stringify(result,null,2)+'\n');
console.log(`Article Lifecycle v2: ${articles.length} article(s), ${refreshQueue.length} refresh candidate(s), ${watchQueue.length} watch, ${duplicateClusters.length} duplicate cluster(s).`);
console.log('Lifecycle is advisory: it does not rewrite, delete, or bypass publication gates.');
