import assert from 'node:assert/strict';
import { extractEvidenceFromHtml } from './evidence-extraction.mjs';

const URL = 'https://techcrunch.com/2026/09/17/the-fix-for-rogue-ai-agents-could-be-more-ai/';
const TITLE = 'The fix for rogue AI agents could be more AI';

const cleanHtml = (html='') => String(html)
  .replace(/<script[\s\S]*?<\/script>/gi,' ')
  .replace(/<style[\s\S]*?<\/style>/gi,' ')
  .replace(/<noscript[\s\S]*?<\/noscript>/gi,' ')
  .replace(/<svg[\s\S]*?<\/svg>/gi,' ')
  .replace(/<[^>]+>/g,' ')
  .replace(/&nbsp;/gi,' ')
  .replace(/&amp;/gi,'&')
  .replace(/&#39;|&apos;/gi,"'")
  .replace(/&quot;/gi,'"')
  .replace(/&#x27;/gi,"'")
  .replace(/&#x2F;/gi,'/')
  .replace(/\s+/g,' ').trim();

const topicWords=(text='')=>new Set(String(text).toLowerCase().split(/[^a-z0-9]+/).filter(w=>w.length>=4));
const splitSentences=(text='')=>String(text).replace(/\s+/g,' ')
  .split(/(?<=[.!?])\s+(?=[A-Z0-9"“])/)
  .map(s=>s.trim()).filter(s=>s.length>=45&&s.length<=700);

const jsonLdObjects=(html='')=>[...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
  .flatMap(m=>{try{const x=JSON.parse(m[1]);return Array.isArray(x)?x:[x];}catch{return[];}})
  .flatMap(x=>x?.['@graph']||[x]).filter(Boolean);

const oldExtractGroundedBody=(html='')=>{
  const structured=jsonLdObjects(html)
    .filter(x=>['Article','NewsArticle','ReportageNewsArticle','AnalysisNewsArticle','BlogPosting']
      .some(t=>String(x?.['@type']||'').includes(t)))
    .sort((a,b)=>String(b.articleBody||'').length-String(a.articleBody||'').length)[0];
  const article=[...html.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/gi)]
    .map(m=>cleanHtml(m[1])).filter(x=>x.length>=300).sort((a,b)=>b.length-a.length)[0]||'';
  const main=[...html.matchAll(/<main\b[^>]*>([\s\S]*?)<\/main>/gi)]
    .map(m=>cleanHtml(m[1])).filter(x=>x.length>=300).sort((a,b)=>b.length-a.length)[0]||'';
  const paragraphs=[...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map(m=>cleanHtml(m[1])).filter(x=>x.length>=50&&x.length<=2500).slice(0,120).join(' ');
  const candidates=[
    {text:cleanHtml(structured?.articleBody||''),kind:'jsonld'},
    {text:article,kind:'article'},
    {text:main,kind:'main'},
    {text:paragraphs,kind:'paragraphs'}
  ].filter(x=>x.text.length>=300).sort((a,b)=>b.text.length-a.text.length);
  return {body:candidates[0]?.text||'',kind:candidates[0]?.kind||'none'};
};

const oldRankedPassages=(body, title)=>{
  const topic=topicWords(title);
  const sentences=splitSentences(body);
  const ranked=sentences.map((text,index)=>{
    const words=topicWords(text);
    const topicScore=[...topic].filter(x=>words.has(x)).length;
    const signalScore=/\b(announced|launched|released|reported|said|found|survey|study|research|percent|million|billion|regulator|regulatory|policy|workers?|employees?|price|funding|investment|approved|blocked|investigation)\b/i.test(text)?1:0;
    return {text,index,score:topicScore*2+signalScore};
  }).sort((a,b)=>b.score-a.score||a.index-b.index);
  const selected=[];
  for(const item of ranked.filter(x=>x.score>0).slice(0,10)){
    for(const idx of [item.index-1,item.index,item.index+1]){
      if(idx>=0&&idx<sentences.length&&!selected.includes(idx))selected.push(idx);
    }
    if(selected.length>=18)break;
  }
  return selected.sort((a,b)=>a-b).slice(0,18).map(i=>sentences[i].slice(0,900));
};

const fetchHtml=async()=>{
  const r=await fetch(URL,{redirect:'follow',signal:AbortSignal.timeout(15000),headers:{
    'user-agent':'Mozilla/5.0 (compatible; TrendForge-P0-real-source-test/1.0)',
    'accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'accept-language':'en-US,en;q=0.9'
  }});
  const html=await r.text();
  if(!r.ok) throw new Error(`HTTP ${r.status}`);
  return {html,finalUrl:r.url};
};

const promo=/25% off|save up to|buy tickets|tickets now|subscribe to our newsletter|follow us for more|advertisement|sponsored|newsletter/i;
const useful=/AI agents|oversight|Apollo|Watcher|observability|Hugging Face|Y Combinator/i;

const {html,finalUrl}=await fetchHtml();
const oldBody=oldExtractGroundedBody(html);
const oldPassages=oldRankedPassages(oldBody.body,TITLE);
const next=extractEvidenceFromHtml(html,TITLE);

const oldText=oldPassages.join(' ');
const newText=next.passages.join(' ');
const oldPromo=oldPassages.filter(x=>promo.test(x)).length;
const newPromo=next.passages.filter(x=>promo.test(x)).length;
const oldUseful=[...oldText.matchAll(useful)].length;
const newUseful=[...newText.matchAll(useful)].length;

console.log('P0 real-source extraction comparison');
console.log(`url=${finalUrl}`);
console.log(`old.kind=${oldBody.kind} old.bodyChars=${oldBody.body.length} old.passages=${oldPassages.length} old.evidenceChars=${oldText.length} old.promoHits=${oldPromo} old.usefulHits=${oldUseful}`);
console.log(`new.kind=${next.kind} new.rawParagraphs=${next.rawParagraphCount} new.passages=${next.passages.length} new.evidenceChars=${newText.length} new.promoHits=${newPromo} new.usefulHits=${newUseful}`);
console.log(`delta.evidenceChars=${newText.length-oldText.length}`);
console.log('new sample:');
for(const p of next.passages.slice(0,6)) console.log('-',p.slice(0,240));

assert.ok(next.passages.length>=3,'new extractor returned too few passages');
assert.ok(next.selectedChars>=300,'new extractor returned too little substantive evidence');
assert.equal(newPromo,0,'new extractor leaked promotional content');
assert.ok(newUseful>=2,'new extractor did not retain enough story-specific evidence');
console.log('P0 real-source test: PASS');
