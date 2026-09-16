import fs from 'node:fs';

const inputPath = 'data/scored-trends.json';
const outputPath = 'data/source-verification.json';
const credibleDomains = new Set([
  'blog.google', 'support.google.com', 'android.com', 'techcrunch.com', 'bbc.com', 'bbc.co.uk',
  'theguardian.com', 'reuters.com', 'apnews.com', 'nytimes.com', 'washingtonpost.com', 'cnbc.com',
  'arstechnica.com', 'theverge.com', 'wired.com', 'zdnet.com', 'security.googleblog.com',
  'blog.cloudflare.com', 'mistral.ai', 'openai.com', 'anthropic.com', 'microsoft.com', 'apple.com',
]);
const DISCOVERY_TIMEOUT_MS = 7000;
const DISCOVERY_LIMIT = 8;
const MIN_DISCOVERY_OVERLAP = 3;
const DISCOVERY_MIN_SCORE = 50;
const CANDIDATE_CONCURRENCY = 6;
const MIRROR_DOMAINS = new Set(['news.google.com', 'google.com', 'google.co.uk']);
const secondLevel = new Set(['co.uk', 'co.in', 'co.jp', 'co.nz', 'co.au', 'com.br', 'com.cn']);

const normalizeUrl = (value) => { try { return new URL(value).toString(); } catch { return null; } };
const domainOf = (value) => { try { return new URL(value).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } };
const publisherFamily = (value) => { const h=domainOf(value); if(!h)return ''; const p=h.split('.'); if(p.length<2)return h; const suffix=p.slice(-2).join('.'); return secondLevel.has(suffix)&&p.length>=3?p.slice(-3).join('.'):suffix; };
const clean = (value = '') => String(value)
  .replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#x27;/gi, "'")
  .replace(/&#(?:x2026;|8230;)/gi, '…').replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/\s+/g, ' ').trim();
const decodeEntities = (value = '') => String(value)
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#x27;/gi, "'")
  .replace(/&nbsp;|&#160;/gi, ' ');
const stop = new Set(['about','after','again','also','been','being','could','from','have','into','more','most','over','said','some','than','that','their','there','these','they','this','what','when','which','with','will','would','your','technology','tech','digital','latest','news','update','updates','guide','how','today','artificial','intelligence','company','companies','industry','development','developments','story','stories','article','articles','exclusive','report']);
const tokens = (value = '') => new Set(clean(value).toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 3 && !stop.has(w)));
const topicOverlap = (a, b) => { const A=tokens(a),B=tokens(b); return [...A].filter(x=>B.has(x)).length; };
const MIRROR_RE = /^(?:https?:\/\/)?(?:www\.)?(?:news\.google\.(?:com|co\.uk)|google\.(?:com|co\.uk))\b/i;
const looksLikeHomepage = (value='') => { try { const u=new URL(value); return !u.pathname || u.pathname==='/' || u.pathname.length<8; } catch { return true; } };
const looksLikeFeed = (value='') => { try { const u=new URL(value); return /^feeds?\./i.test(u.hostname)||/^rss\./i.test(u.hostname)||/^feed\./i.test(u.hostname)||/(^|\/)(rss|feed|feeds|atom|sitemap)(\/|\.|$)/i.test(u.pathname)||/(^|&)(feed|rss|atom|format)=/i.test(u.search.slice(1)); } catch { return true; } };

function extractDescriptionLinks(rawDescription) {
  const links=[];
  const decoded=decodeEntities(rawDescription);
  for(const match of decoded.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
    const url=normalizeUrl(match[1]), text=clean(match[2]);
    if(!url||!text||MIRROR_RE.test(url)||looksLikeHomepage(url)||looksLikeFeed(url))continue;
    links.push({url,text});
  }
  return links;
}

async function fetchText(url){
  try{const response=await fetch(url,{method:'GET',redirect:'follow',signal:AbortSignal.timeout(DISCOVERY_TIMEOUT_MS),headers:{'user-agent':'TrendForge-source-discovery/2.3','accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'}});if(!response.ok)return null;return{text:await response.text(),finalUrl:response.url||url};}catch{return null;}
}

async function discoverRelatedSources(trend,seedSources){
  const query=encodeURIComponent(clean(trend.title));
  const rssUrl=`https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;
  const result=await fetchText(rssUrl); if(!result)return[];
  const items=[...result.text.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(m=>m[1]);
  const seeds=new Set(seedSources.map(s=>publisherFamily(s.url)).filter(Boolean));
  const relevantItems=items.map(item=>{
    const title=clean((item.match(/<title>([\s\S]*?)<\/title>/i)||[,''])[1]);
    const rawDescription=(item.match(/<description>([\s\S]*?)<\/description>/i)||[,''])[1];
    const description=clean(rawDescription);
    const link=normalizeUrl(clean((item.match(/<link>([\s\S]*?)<\/link>/i)||[,''])[1]));
    const sourceMatch=item.match(/<source\b[^>]*\burl=["']([^"']+)["'][^>]*>/i);
    const publisherUrl=normalizeUrl(clean(sourceMatch?.[1]||''));
    const descriptionLinks=extractDescriptionLinks(rawDescription);
    const overlap=topicOverlap(`${trend.title} ${trend.description||''}`,`${title} ${description}`);
    return{title,description,link,publisherUrl,descriptionLinks,overlap};
  }).filter(item=>item.title&&item.overlap>=MIN_DISCOVERY_OVERLAP&&(item.publisherUrl||item.link||item.descriptionLinks.length))
    .sort((a,b)=>b.overlap-a.overlap).slice(0,DISCOVERY_LIMIT);

  const discovered=[];
  for(const item of relevantItems){
    const candidates=[];
    for(const link of item.descriptionLinks){
      const d=domainOf(link.url); if(!d||MIRROR_DOMAINS.has(d)||seeds.has(publisherFamily(link.url)))continue;
      const linkOverlap=topicOverlap(`${trend.title} ${trend.description||''}`,`${item.title} ${link.text}`);
      if(looksLikeHomepage(link.url)||looksLikeFeed(link.url))continue;
      candidates.push({url:link.url,score:linkOverlap+item.overlap,resolvedFrom:'google-news-description-link'});
    }
    if(item.link && !MIRROR_RE.test(item.link)){
      const resolved=await fetchText(item.link); const finalUrl=normalizeUrl(resolved?.finalUrl||''); const d=domainOf(finalUrl);
      if(finalUrl&&d&&!MIRROR_DOMAINS.has(d)&&!seeds.has(publisherFamily(finalUrl))&&!looksLikeHomepage(finalUrl)&&!looksLikeFeed(finalUrl))candidates.push({url:finalUrl,score:item.overlap+1,resolvedFrom:'google-news-article-link'});
    }
    candidates.sort((a,b)=>b.score-a.score);
    const chosen=candidates.find(c=>c.score>=item.overlap+1);
    if(!chosen)continue;
    const d=domainOf(chosen.url);
    discovered.push({title:item.title,url:chosen.url,sourceName:d,discovered:true,relevanceOverlap:item.overlap,resolvedFrom:chosen.resolvedFrom,discoveryTitle:item.title,discoveryDescription:item.description});
    if(discovered.length>=DISCOVERY_LIMIT)break;
  }
  return discovered;
}

async function checkUrl(url){const started=Date.now();try{const response=await fetch(url,{method:'GET',redirect:'follow',signal:AbortSignal.timeout(8000),headers:{'user-agent':'TrendForge-source-verifier/2.3'}});return{ok:response.ok,status:response.status,finalUrl:response.url||url,latencyMs:Date.now()-started};}catch(error){return{ok:false,status:0,finalUrl:url,latencyMs:Date.now()-started,error:error?.message||String(error)};}}

async function verifyCandidate(trend){
  const rawSources=Array.isArray(trend.sources)&&trend.sources.length?trend.sources:[{title:trend.sourceName||trend.title,url:trend.sourceUrl||trend.link}];
  const seedSources=rawSources.map(source=>({...source,url:normalizeUrl(source.url)})).filter(source=>source.url&&!MIRROR_DOMAINS.has(domainOf(source.url))&&!looksLikeHomepage(source.url)&&!looksLikeFeed(source.url));
  const trendLink=normalizeUrl(trend.link||'');
  if(trendLink&&!MIRROR_DOMAINS.has(domainOf(trendLink))&&!looksLikeHomepage(trendLink)&&!looksLikeFeed(trendLink))seedSources.unshift({title:trend.title,url:trendLink,resolvedFrom:'research-story-link'});
  const seedFamilies=new Set(seedSources.map(source=>publisherFamily(source.url)).filter(Boolean));
  const score=Number(trend.score??trend.finalScore??trend.priorityScore??0);
  const discoveryEligible=seedFamilies.size<2&&(score>=DISCOVERY_MIN_SCORE||seedFamilies.size===0);
  const discovered=discoveryEligible?await discoverRelatedSources(trend,seedSources):[];
  const combined=[...seedSources,...discovered]; const deduped=[]; const seenUrls=new Set();
  for(const source of combined){const url=normalizeUrl(source.url);if(!url||seenUrls.has(url)||MIRROR_DOMAINS.has(domainOf(url))||looksLikeHomepage(url)||looksLikeFeed(url))continue;seenUrls.add(url);deduped.push({...source,url});}
  const checks=[];
  for(const source of deduped.slice(0,10)){
    const domain=domainOf(source.url); if(MIRROR_DOMAINS.has(domain)||looksLikeHomepage(source.url)||looksLikeFeed(source.url))continue;
    const check=await checkUrl(source.url); const finalDomain=domainOf(check.finalUrl||source.url);
    const finalUrl=check.finalUrl||source.url;
    checks.push({title:source.title||'',url:source.url,domain:finalDomain||domain,publisherFamily:publisherFamily(finalUrl||source.url),credibleDomain:credibleDomains.has(finalDomain||domain),discovered:Boolean(source.discovered),relevanceOverlap:source.relevanceOverlap||0,resolvedFrom:source.resolvedFrom||'seed',discoveryTitle:source.discoveryTitle||'',discoveryDescription:source.discoveryDescription||'',finalUrl,finalUrlIsHomepage:looksLikeHomepage(finalUrl),finalUrlIsFeed:looksLikeFeed(finalUrl),...check});
  }
  const reachable=checks.filter(item=>item.ok&&!item.finalUrlIsHomepage&&!item.finalUrlIsFeed);
  const credible=reachable.filter(item=>item.credibleDomain);
  const uniqueDomains=new Set(reachable.map(item=>item.domain).filter(d=>d&&!MIRROR_DOMAINS.has(d)));
  const independentFamilies=new Set(reachable.map(item=>item.publisherFamily).filter(Boolean));
  const relevantReachable=reachable.filter(item=>!item.discovered||item.relevanceOverlap>=MIN_DISCOVERY_OVERLAP);
  const confidence=Math.round((checks.length?reachable.length/checks.length:0)*45+(checks.length?credible.length/checks.length:0)*25+Math.min(independentFamilies.size/2,1)*20+Math.min(relevantReachable.length/2,1)*10);
  return{link:trend.link,title:trend.title,category:trend.category,verifiedAt:new Date().toISOString(),sourceCount:checks.length,discoveredSourceCount:discovered.length,reachableSourceCount:reachable.length,credibleSourceCount:credible.length,uniqueDomainCount:independentFamilies.size,independentReachableDomains:[...uniqueDomains],independentPublisherFamilies:[...independentFamilies],independentPublisherCount:independentFamilies.size,relevantReachableSourceCount:relevantReachable.length,confidence,status:confidence>=70?'verified':confidence>=45?'partial':'unverified',discovery:{enabled:discoveryEligible,queryTitle:discoveryEligible?trend.title:null,sameStoryOnly:true,minTopicOverlap:MIN_DISCOVERY_OVERLAP,googleNewsIsIndexOnly:true,resolvedPublisherLinks:true,descriptionArticleLinksEnabled:true,escapedDescriptionLinksDecoded:true,minScore:DISCOVERY_MIN_SCORE,seedDomainCount:seedFamilies.size,seedPublisherFamilyCount:seedFamilies.size},sources:checks};
}

async function mapWithConcurrency(items,limit,worker){const results=new Array(items.length);let nextIndex=0;async function runWorker(){while(true){const index=nextIndex++;if(index>=items.length)return;results[index]=await worker(items[index],index);}}await Promise.all(Array.from({length:Math.min(limit,items.length)},()=>runWorker()));return results;}
if(!fs.existsSync(inputPath)){console.log(`No ${inputPath}; source verification skipped.`);process.exit(0);}
const research=JSON.parse(fs.readFileSync(inputPath,'utf8'));const trends=research.trends??[];const startedAt=Date.now();const records=await mapWithConcurrency(trends,CANDIDATE_CONCURRENCY,verifyCandidate);const durationMs=Date.now()-startedAt;
fs.mkdirSync('data',{recursive:true});fs.writeFileSync(outputPath,`${JSON.stringify({version:4,generatedAt:new Date().toISOString(),durationMs,candidateConcurrency:CANDIDATE_CONCURRENCY,discoveryMinScore:DISCOVERY_MIN_SCORE,records},null,2)}\n`);
const verified=records.filter(record=>record.status==='verified').length,partial=records.filter(record=>record.status==='partial').length,unverified=records.filter(record=>record.status==='unverified').length;const discovered=records.reduce((sum,record)=>sum+record.discoveredSourceCount,0),independentFamilies=records.reduce((sum,record)=>sum+record.independentPublisherCount,0),discoveryEnabled=records.filter(record=>record.discovery?.enabled).length;
console.log(`Source Verification v4: ${records.length} candidate(s) checked — ${verified} verified, ${partial} partial, ${unverified} unverified.`);
console.log(`Evidence discovery: ${discovered} discovered publisher article source(s), ${independentFamilies} candidate-level independent publisher family count(s).`);
console.log(`Evidence discovery: ${discoveryEnabled} candidate(s) enriched (score >= ${DISCOVERY_MIN_SCORE} or no independent seed family).`);
console.log(`Evidence discovery: candidate-scoped Google News discovery, topic overlap >= ${MIN_DISCOVERY_OVERLAP}, Google domains excluded, feed/homepage URLs excluded, publisher-family aware source counts.`);
