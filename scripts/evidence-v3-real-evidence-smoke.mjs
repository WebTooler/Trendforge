import fs from 'node:fs';
import { extractEvidenceFromHtml } from './evidence-extraction.mjs';
import { scoreEvidenceCoverage } from './evidence-coverage.mjs';
import { deriveEvidenceArticleBlueprint } from './evidence-article-blueprint.mjs';

const INPUT='data/source-verification.json';
const OUTPUT='data/evidence-v3-real-evidence-smoke.json';
const MAX_CANDIDATES=8;
const TIMEOUT=9000;

const clean=(s='')=>String(s).replace(/\s+/g,' ').trim();
const domainOf=(u='')=>{try{return new URL(u).hostname.replace(/^www\./,'').toLowerCase();}catch{return '';}};
const familyOf=(u='')=>{const h=domainOf(u);const p=h.split('.');if(p.length<2)return h;const suffix=p.slice(-2).join('.');const second=new Set(['co.uk','co.in','co.jp','co.nz','co.au','com.br','com.cn']);return second.has(suffix)&&p.length>=3?p.slice(-3).join('.'):suffix;};

async function fetchPage(url){
  try{
    const r=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(TIMEOUT),headers:{'user-agent':'TrendForge-evidence-smoke/1.0','accept':'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8'}});
    if(!r.ok)return null;
    const html=await r.text();
    return {html,finalUrl:r.url||url};
  }catch{return null;}
}

if(!fs.existsSync(INPUT)){console.error('Missing source verification input.');process.exit(1);}
const verification=JSON.parse(fs.readFileSync(INPUT,'utf8'));
const candidates=(verification.records||[])
  .filter(r=>r.status==='verified')
  .sort((a,b)=>(b.confidence||0)-(a.confidence||0))
  .slice(0,MAX_CANDIDATES);

const results=[];
for(const record of candidates){
  const sourceRows=(record.sources||[])
    .filter(s=>s.ok&&!s.finalUrlIsHomepage&&!s.finalUrlIsFeed)
    .sort((a,b)=>(Number(b.credibleDomain)-Number(a.credibleDomain))||(b.relevanceOverlap||0)-(a.relevanceOverlap||0));
  const seenFamilies=new Set();
  const sources=[];
  for(const source of sourceRows){
    const url=source.finalUrl||source.url;
    const fam=familyOf(url);
    if(!fam||seenFamilies.has(fam))continue;
    const page=await fetchPage(url);
    if(!page)continue;
    const evidence=extractEvidenceFromHtml(page.html,record.title);
    if(!evidence.body||evidence.selectedPassageCount<3)continue;
    seenFamilies.add(fam);
    sources.push({
      url:page.finalUrl,
      domain:domainOf(page.finalUrl),
      publisherFamily:fam,
      title:source.title||record.title,
      primary:false,
      verified:true,
      credibilityTier:source.credibilityTier||'unknown',
      passages:evidence.passages,
      body:evidence.body,
      extraction:evidence
    });
    if(sources.length>=4)break;
  }
  const coverage=scoreEvidenceCoverage({sources});
  const blueprint=deriveEvidenceArticleBlueprint(coverage);
  results.push({
    title:record.title,
    category:record.category,
    verificationStatus:record.status,
    verificationConfidence:record.confidence,
    sourceVerification:record,
    sources,
    coverage,
    blueprint
  });
}

const rich=results.filter(x=>x.coverage.band==='rich').length;
const usable=results.filter(x=>x.coverage.band==='usable').length;
const thin=results.filter(x=>x.coverage.band==='thin').length;
const insufficient=results.filter(x=>x.coverage.band==='insufficient').length;
const ready=results.filter(x=>x.coverage.readyForRichArticle).length;

fs.mkdirSync('data',{recursive:true});
fs.writeFileSync(OUTPUT,JSON.stringify({
  version:1,
  generatedAt:new Date().toISOString(),
  policy:'Real verified publisher pages only. No AI generation, no publication, no main-branch changes.',
  candidatesChecked:candidates.length,
  results,
  summary:{rich,usable,thin,insufficient,readyForRichArticle:ready}
},null,2)+'\n');

console.log(`Real Evidence Smoke: ${candidates.length} verified candidates inspected.`);
console.log(`Evidence bands: rich=${rich}, usable=${usable}, thin=${thin}, insufficient=${insufficient}.`);
console.log(`readyForRichArticle=${ready}.`);
for(const r of results){
  console.log(JSON.stringify({
    title:r.title,
    confidence:r.verificationConfidence,
    sources:r.coverage.sourceCount,
    families:r.coverage.independentPublisherFamilies,
    chars:r.coverage.totalChars,
    passages:r.coverage.totalPassages,
    factualSignals:r.coverage.factualSignals,
    score:r.coverage.score,
    band:r.coverage.band,
    ready:r.coverage.readyForRichArticle,
    blockers:r.coverage.blockers
  }));
}
