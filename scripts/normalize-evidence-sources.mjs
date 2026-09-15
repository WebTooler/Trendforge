import fs from 'node:fs';

const inputPath='data/source-verification.json';
const outputPath='data/source-verification.json';
const NON_ARTICLE_PATH=/(^|\/)(?:rss|feed|feeds|atom|sitemap)(?:\/|\.|$)/i;
const NON_ARTICLE_QUERY=/(^|&)(?:output|format|feed|rss|atom)=/i;
const knownSecondLevel=new Set(['co.uk','com.au','co.nz','co.in','co.jp','com.br','com.cn']);

const hostOf=(url='')=>{try{return new URL(url).hostname.replace(/^www\./,'').toLowerCase();}catch{return '';}};
const publisherFamily=(url='')=>{const h=hostOf(url);if(!h)return '';const p=h.split('.');if(p.length<2)return h;const suffix=p.slice(-2).join('.');if(knownSecondLevel.has(suffix)&&p.length>=3)return p.slice(-3).join('.');return suffix;};
const articleUrl=(value='')=>{try{const u=new URL(value);const path=u.pathname||'/';if(path==='/'||path.length<8)return false;if(NON_ARTICLE_PATH.test(path)||NON_ARTICLE_QUERY.test(u.search.slice(1)))return false;if(/^feeds?\./i.test(u.hostname)||/^rss\./i.test(u.hostname)||/^feed\./i.test(u.hostname))return false;return true;}catch{return false;}};

if(!fs.existsSync(inputPath)){console.log('Evidence source normalization skipped: source-verification.json missing.');process.exit(0);}
const data=JSON.parse(fs.readFileSync(inputPath,'utf8'));
let removed=0, familyCollisions=0;
for(const record of data.records||[]){
  const original=Array.isArray(record.sources)?record.sources:[];
  const filtered=[];const families=new Set();const urls=new Set();
  for(const source of original){
    const url=source.finalUrl||source.url||'';const host=hostOf(url);const family=publisherFamily(url);
    if(!host||!articleUrl(url)||!family){removed++;continue;}
    if(urls.has(url)){removed++;continue;}
    if(families.has(family)){familyCollisions++;removed++;continue;}
    urls.add(url);families.add(family);filtered.push({...source,publisherFamily:family,articleEvidenceEligible:true});
  }
  record.sources=filtered;
  record.sourceCount=filtered.length;
  record.reachableSourceCount=filtered.filter(s=>s.ok).length;
  record.uniqueDomainCount=new Set(filtered.map(s=>hostOf(s.finalUrl||s.url||'')).filter(Boolean)).size;
  record.independentReachableDomains=[...new Set(filtered.filter(s=>s.ok).map(s=>hostOf(s.finalUrl||s.url||'')).filter(Boolean))];
  record.relevantReachableSourceCount=filtered.filter(s=>s.ok&&(!s.discovered||Number(s.relevanceOverlap||0)>=3)).length;
  record.discoveredSourceCount=filtered.filter(s=>s.discovered).length;
  const score=Number(record.confidence||0);
  record.status=score>=70?'verified':score>=45?'partial':'unverified';
  record.evidenceSourcePolicy={publisherFamilyDeduped:true,articleUrlsOnly:true,feedUrlsRejected:true};
}
data.version=4;data.generatedAt=new Date().toISOString();data.independentPublisherPolicy={minIndependentPublisherFamilies:2,feedUrlsRejected:true,samePublisherSubdomainsNotIndependent:true};
fs.writeFileSync(outputPath,JSON.stringify(data,null,2)+'\n');
console.log(`Evidence source normalization v1: removed ${removed} non-independent/non-article source(s); ${familyCollisions} same-publisher collisions removed.`);
