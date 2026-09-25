const decodeEntities=(s='')=>String(s)
  .replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;|&#x27;/gi,"'")
  .replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&nbsp;|&#160;/gi,' ')
  .replace(/&#(?:x2026;|8230;)/gi,'…');

const cleanText=(s='')=>decodeEntities(String(s)
  .replace(/<!\[CDATA\[/gi,' ').replace(/\]\]>/gi,' ')
  .replace(/<script[\s\S]*?<\/script>/gi,' ')
  .replace(/<style[\s\S]*?<\/style>/gi,' ')
  .replace(/<noscript[\s\S]*?<\/noscript>/gi,' ')
  .replace(/<svg[\s\S]*?<\/svg>/gi,' ')
  .replace(/<[^>]+>/g,' '))
  .replace(/\s+/g,' ').trim();

const tokens=(s='')=>new Set(cleanText(s).toLowerCase().split(/[^a-z0-9]+/).filter(w=>w.length>=4));
const splitSentences=(s='')=>cleanText(s)
  .split(/(?<=[.!?])\s+(?=[A-Z0-9"“])/)
  .map(x=>x.trim()).filter(x=>x.length>=45&&x.length<=900);

const JUNK=[
  /^(?:25%\s+off|save\s+up\s+to|buy\s+tickets|tickets?\s+now|subscribe|sign\s+up|newsletter)/i,
  /^(?:advertisement|advertising|sponsored|promoted|partner content)\b/i,
  /^(?:follow us|read more|related|most popular|trending|watch now|listen now)\b/i,
  /(?:privacy policy|terms of service|cookie policy|manage cookies)/i,
  /(?:^|\s)(?:click here|learn more|shop now|download now)(?:\s|$)/i,
  /\b(?:tickets?|discount|save\s+up\s+to|%\s*off)\b.*\b(?:disrupt|conference|event|summit)\b/i,
  /\b(?:disrupt|conference|event|summit)\b.*\b(?:tickets?|discount|save\s+up\s+to|%\s*off)\b/i,
  /^back\s+by\s+popular\s+demand\b/i
];

const isJunk=(text='')=>{
  const t=cleanText(text);
  if(t.length<45||t.length>3000)return true;
  if(JUNK.some(re=>re.test(t)))return true;
  const lower=t.toLowerCase();
  const linkLike=(t.match(/https?:\/\//g)||[]).length;
  if(linkLike>0)return true;
  if((lower.match(/\b(?:tickets|subscribe|newsletter|advertisement|sponsored|coupon|discount)\b/g)||[]).length>=2)return true;
  return false;
};

const jsonLdObjects=(html='')=>[...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
  .flatMap(m=>{try{const x=JSON.parse(m[1]);return Array.isArray(x)?x:[x];}catch{return[];}})
  .flatMap(x=>x?.['@graph']||[x]).filter(Boolean);

const articleBodyFromJsonLd=(html='')=>{
  const objects=jsonLdObjects(html)
    .filter(x=>['Article','NewsArticle','ReportageNewsArticle','AnalysisNewsArticle','BlogPosting']
      .some(t=>String(x?.['@type']||'').includes(t)))
    .map(x=>({body:cleanText(x.articleBody||''),headline:cleanText(x.headline||''),description:cleanText(x.description||'')}))
    .filter(x=>x.body.length>=300)
    .sort((a,b)=>b.body.length-a.body.length);
  return objects[0]||null;
};

const paragraphCandidates=(html='')=>[...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
  .map((m,index)=>({index,text:cleanText(m[1])}))
  .filter(x=>!isJunk(x.text));

const scoreParagraph=(text,storyTitle)=>{
  const A=tokens(text),B=tokens(storyTitle);
  const overlap=[...B].filter(x=>A.has(x)).length;
  const rareEntityOverlap=[...B].filter(x=>A.has(x)&&x.length>=7).length;
  const numericOverlap=[...String(storyTitle).matchAll(/\b\d+(?:[.,]\d+)?\b/g)].filter(m=>String(text).includes(m[0])).length;
  const factual=/\b(?:announced|launched|released|reported|said|found|study|research|survey|percent|million|billion|approved|blocked|investigation|according|official|CEO|chief|company|product|model|agents?|incident|policy|regulator|funding|investment)\b/i.test(text)?3:0;
  const quote=/["“][^"”]{12,}["”]/.test(text)?1:0;
  return overlap*2+Math.min(4,rareEntityOverlap*2)+Math.min(4,numericOverlap*2)+factual+quote;
};

export function extractEvidenceFromHtml(html='',storyTitle='',storyContext=''){
  const jsonld=articleBodyFromJsonLd(html);
  const paragraphs=paragraphCandidates(html);
  const anchorText=[storyTitle,storyContext,jsonld?.headline||'',jsonld?.description||''].filter(Boolean).join(' ');
  const scored=paragraphs.map(p=>({...p,score:scoreParagraph(p.text,anchorText)}));
  const high=scored.filter(p=>p.score>0);
  const selected=[];
  const seen=new Set();
  const add=p=>{if(!p||seen.has(p.index))return;seen.add(p.index);selected.push(p);};

  // Prefer paragraphs that carry story-specific/factual signals, then include
  // nearby paragraphs to preserve context. Never include obvious promotional junk.
  for(const p of high.sort((a,b)=>b.score-a.score||a.index-b.index).slice(0,24)){
    add(p);
    add(scored.find(x=>x.index===p.index-1));
    add(scored.find(x=>x.index===p.index+1));
    if(selected.length>=36)break;
  }

  let passages=selected.sort((a,b)=>a.index-b.index).map(x=>x.text).slice(0,36);
  let body=passages.join(' ');

  if(jsonld){
    const jsonParagraphs=splitSentences(jsonld.body).filter(x=>!isJunk(x));
    if(jsonParagraphs.length>=3){
      const jsonSelected=jsonParagraphs.filter(x=>scoreParagraph(x,anchorText)>0).slice(0,36);
      if(jsonSelected.length>=3){
        passages=jsonSelected;
        body=jsonSelected.join(' ');
      }
    }
  }

  // If story-specific scoring is too sparse, fall back to clean article paragraphs,
  // not the raw page/article container. This prevents ad/nav contamination.
  if(passages.length<3){
    passages=paragraphs.slice(0,36).map(x=>x.text);
    body=passages.join(' ');
  }

  return {
    body,
    passages,
    kind: jsonld&&passages.length>=3?'jsonld-evidence':'paragraph-evidence',
    headline:jsonld?.headline||'',
    description:jsonld?.description||'',
    rawParagraphCount:paragraphs.length,
    selectedPassageCount:passages.length,
    selectedChars:body.length
  };
}
