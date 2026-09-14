import fs from 'node:fs';

const articlesDir = 'content/articles';
const outputPath = 'data/article-lifecycle.json';
const now = Date.now();
const DAY = 24 * 60 * 60 * 1000;

const parseFrontmatter = (raw, key) => raw.match(new RegExp(`^${key}:\\s*[\"']?(.+?)[\"']?\\s*$`, 'mi'))?.[1]?.trim() || '';
const normalize = (s='') => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
const tokens = (s='') => new Set(normalize(s).split(' ').filter(w => w.length >= 5));
const overlap = (a,b) => { const x=tokens(a), y=tokens(b); if(!x.size||!y.size)return 0; let n=0; for(const w of x)if(y.has(w))n++; return n/Math.max(x.size,y.size); };

if (!fs.existsSync(articlesDir)) {
  fs.mkdirSync('data',{recursive:true});
  fs.writeFileSync(outputPath, JSON.stringify({version:1,generatedAt:new Date().toISOString(),articles:[],refreshQueue:[]},null,2)+'\n');
  console.log('Article Lifecycle v1: no articles found.');
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
  // Count source URLs without a fragile markdown-specific regex.
  const sourceCount=(raw.match(/https:\/\/[^)\s]+/g)||[]).length;
  const staleness=ageDays>=30?100:ageDays>=14?75:ageDays>=7?45:10;
  const completeness= Math.min(100, (words>=700?45:words>=450?35:words>=250?25:15) + (sourceCount>=2?35:sourceCount===1?20:0) + (parseFrontmatter(raw,'description').length>=100?20:10));
  const refreshScore=Math.round(staleness*0.55+completeness*0.45);
  let status='fresh';
  if(refreshScore>=75)status='refresh_candidate'; else if(refreshScore>=45)status='watch';
  return {file,title,category,publishedAt,ageDays:Math.round(ageDays*10)/10,words,sourceCount,refreshScore,status};
});

articles.sort((a,b)=>b.refreshScore-a.refreshScore);
const refreshQueue=articles.filter(a=>a.status==='refresh_candidate').slice(0,50).map((a,index)=>({...a,priority:index+1,reason:a.ageDays>=30?'older than 30 days':a.ageDays>=14?'older than 14 days':'content completeness suggests review'}));

// Detect title clusters so lifecycle refreshes can be merged instead of creating near-duplicates.
const clusters=[];
for(const article of articles){
  const match=clusters.find(c=>overlap(article.title,c.title)>=0.65);
  if(match)match.members.push(article.title); else clusters.push({title:article.title,members:[article.title]});
}

const result={version:1,generatedAt:new Date().toISOString(),policy:{refreshCandidateScore:75,watchScore:45,doesNotAutoRewrite:true,maxQueueSize:50},summary:{articles:articles.length,refreshCandidates:refreshQueue.length,watch:articles.filter(a=>a.status==='watch').length},articles,refreshQueue,clusters:clusters.filter(c=>c.members.length>1)};
fs.mkdirSync('data',{recursive:true});
fs.writeFileSync(outputPath,JSON.stringify(result,null,2)+'\n');
console.log(`Article Lifecycle v1: ${articles.length} article(s), ${refreshQueue.length} refresh candidate(s), ${result.summary.watch} watch.`);
