import fs from 'node:fs';

const articlesDir='content/articles';
const outputPath='data/distribution-intelligence.json';
const channels=['Google Search','Newsletter','RSS','Social','Direct'];
const front=(raw,key)=>raw.match(new RegExp(`^${key}:\\s*[\"']?(.+?)[\"']?\\s*$`,'mi'))?.[1]?.trim()||'';
const files=fs.existsSync(articlesDir)?fs.readdirSync(articlesDir).filter(f=>f.endsWith('.md')):[];
const articles=files.map(file=>{const raw=fs.readFileSync(`${articlesDir}/${file}`,'utf8');const title=front(raw,'title')||file;const slug=front(raw,'slug')||file.replace(/\\.md$/,'');const category=front(raw,'category')||'Technology';const description=front(raw,'description');return {title,slug,category,description};});

const plan=articles.slice(-20).reverse().map(article=>({slug:article.slug,title:article.title,category:article.category,channels:[
  {channel:'Google Search',action:'publish and keep canonical/indexable',reason:'organic discovery'},
  {channel:'Newsletter',action:'include when relevant',reason:'subscriber retention'},
  {channel:'RSS',action:'make available through feed',reason:'reader-controlled distribution'},
  {channel:'Social',action:'share a concise human-written excerpt',reason:'additional discovery'},
  {channel:'Direct',action:'link from related articles',reason:'internal discovery'}
]}));

const result={version:1,generatedAt:new Date().toISOString(),policy:{privacyFirst:true,no_scraping:true,no_auto_social_posting:true,no_paid_distribution_required:true,requires_human_or_provider_auth_for_external_posting:true},supportedChannels:channels,articlePlans:plan,summary:{articlesPlanned:plan.length,externalPostingPerformed:false}};
fs.mkdirSync('data',{recursive:true});fs.writeFileSync(outputPath,JSON.stringify(result,null,2)+'\\n');
console.log(`Distribution Intelligence v1: prepared ${plan.length} article plan(s); no external posting performed.`);
