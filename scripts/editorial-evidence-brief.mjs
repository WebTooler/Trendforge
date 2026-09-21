const STOP=new Set('about after again also been being could from have into more most over said some than that their there these they this what when which with will would your technology tech digital latest news article articles story stories report reports reported according development developments company companies industry stock stocks shares market markets price prices product products service services system systems model models models model technology tech ai intelligence digital data today yesterday tomorrow while where whose through before between under using used uses make makes made less then still already now just even only often usually including another around really very much many somewhat generally'.split(' '));
const FACTUAL=/\b(?:announced|launch(?:ed|es)?|released|reported|said|found|study|research|survey|percent|million|billion|approved|blocked|investigation|according|official|ceo|company|companies|product|model|models|agent|agents|incident|policy|regulator|funding|investment|acquisition|partnership|shares|stock|price|revenue|profit|loss|deal|agreement|vote|election|court|lawsuit|security|breach|hack(?:ed|ing)?|update|introduced|unveiled|confirmed|denied|allowed|banned|cut|raised|fell|rose|increased|decreased)\b/i;
const JUNK=/^(?:advertisement|advertising|sponsored|promoted|partner content|follow us|read more|related|most popular|trending|watch now|listen now|subscribe|sign up|newsletter|when you purchase|last day to book|buy tickets|tickets? now|save up to|click here|learn more|shop now|download now)\b/i;\nconst BOILERPLATE=/^(?:task force report by .+?\s*[•·]\s*\w+\s+\d{1,2},\s*\d{4}|\w+\s+\d{1,2}-\d{1,2},\s*\d{4}\s*\|.*|we are the premier hub and policy institution|premier hub and policy institution|critical minerals energy policy innovation|technology innovation|.*get the latest news and research on .*|.*scholars reflect on some of the standout issues.*)$/i;
const normalizeWord=w=>{w=String(w).toLowerCase();if(w.length>6&&w.endsWith('ies'))return w.slice(0,-3)+'y';if(w.length>6&&w.endsWith('ing'))return w.slice(0,-3);if(w.length>5&&w.endsWith('ed'))return w.slice(0,-2);if(w.length>5&&w.endsWith('s'))return w.slice(0,-1);return w;};
const tokens=t=>new Set(String(t).toLowerCase().replace(/[^a-z0-9]+/g,' ').split(/\s+/).map(normalizeWord).filter(w=>w.length>=4&&!STOP.has(w)));
const sentenceSplit=t=>String(t).replace(/\s+/g,' ').trim().split(/(?<=[.!?])\s+(?=[A-Z0-9"“$])/).map(x=>x.trim()).filter(x=>x.length>=45&&x.length<=900);
const numbers=t=>new Set((String(t).match(/\b\d+(?:[.,]\d+)?\s*(?:%|percent|percentage|million|billion|thousand|bn|mn|m|b|k)?\b/gi)||[]).map(x=>x.toLowerCase().replace(/,/g,'').replace(/\s+/g,' ').trim()));
const entities=t=>new Set([...String(t).matchAll(/\b[A-Z][A-Za-z0-9&.-]*(?:\s+[A-Z][A-Za-z0-9&.-]*){0,3}\b/g)].map(m=>m[0].trim().toLowerCase()).filter(x=>x.length>=3&&!STOP.has(x)));
const overlap=(a,b)=>{const A=tokens(a),B=tokens(b),shared=[...A].filter(x=>B.has(x));return{shared,count:shared.length,coverage:shared.length/Math.max(1,A.size)};};
const phraseOverlap=(a,b)=>{const words=x=>String(x).toLowerCase().replace(/[^a-z0-9]+/g,' ').split(/\s+/).filter(Boolean);const grams=x=>{const s=new Set();for(let i=0;i<x.length-1;i++)s.add(x[i]+' '+x[i+1]);return s};const A=grams(words(a)),B=grams(words(b));return[...A].filter(x=>B.has(x)).length;};
const polarityGroups=[['increased','decreased','increase','decrease','rose','fell','rising','falling','gained','lost','gain','loss','grew','declined','reduced','raised','lowered','cut'],['approved','rejected','allowed','banned','approve','reject','allow','ban'],['launched','cancelled','launch','cancel','confirmed','denied','confirm','deny'],['supports','opposes','support','oppose']];
const contradiction=(a,b)=>{const lower=x=>String(x).toLowerCase();for(const group of polarityGroups){const ca=group.filter(w=>new RegExp('\\b'+w+'\\b').test(lower(a))),cb=group.filter(w=>new RegExp('\\b'+w+'\\b').test(lower(b)));if(!ca.length||!cb.length)continue;const pos=new Set(['increased','increase','rose','rising','gained','gain','grew','raised','approved','approve','allowed','allow','launched','launch','confirmed','confirm','supports','support']);const cPos=ca.some(x=>pos.has(x)),ePos=cb.some(x=>pos.has(x));if(cPos!==ePos)return true;}return false;};
function relevanceScore(text,story){
  const storyText=story.title+' '+(story.description||'');
  const o=overlap(text,storyText); const e=entities(text),se=entities(storyText); const entityShared=[...e].filter(x=>se.has(x)).length;
  const num=numbers(text); const storyNums=numbers(storyText); const numericMatch=[...num].filter(x=>storyNums.has(x)).length;
  const anchor=phraseOverlap(text,story.title);
  const fact=FACTUAL.test(text)?1:0; const quote=/["“][^"”]{12,}["”]/.test(text)?1:0;
  return {score:o.count*2+Math.min(6,entityShared*3)+Math.min(2,num.size)+Math.min(4,numericMatch*2)+Math.min(4,anchor*2)+fact+quote,topicOverlap:o.count,entityShared,numbers:num.size,numericMatch,anchor};
}
function isNoise(text){const x=String(text).replace(/\s+/g,' ').trim();if(x.length<45||x.length>3000)return true;if(JUNK.test(x)||BOILERPLATE.test(x))return true;if(/https?:\/\//i.test(x))return true;if((x.match(/\b(?:tickets?|subscribe|newsletter|advertisement|sponsored|coupon|discount)\b/gi)||[]).length>=2)return true;return false;}

export function buildEditorialEvidenceBrief({candidate={},sources=[]}={}){
  const story={title:String(candidate.title||''),description:String(candidate.description||'')};
  const normalizedSources=[]; const allClaims=[]; let rawPassageCount=0;
  for(let si=0;si<sources.length;si++){
    const source=sources[si]||{}; const raw=Array.isArray(source.passages)?source.passages.map(x=>String(x).replace(/\s+/g,' ').trim()).filter(Boolean):[];
    rawPassageCount+=raw.length;
    const units=[];
    for(let pi=0;pi<raw.length;pi++){
      const passage=raw[pi]; if(isNoise(passage))continue;
      const sentences=sentenceSplit(passage);
      const sentenceUnits=sentences.length?sentences:[passage];
      for(const sentence of sentenceUnits){
        if(isNoise(sentence))continue;
        const rel=relevanceScore(sentence,story);
        const fallbackRel=relevanceScore(passage,story);
        const effectiveRel=rel.score>=fallbackRel.score?rel:fallbackRel;
        const titleAnchor=overlap(sentence,story.title);
        const storyAnchored=titleAnchor.count>=2||effectiveRel.numericMatch>0||effectiveRel.entityShared>0;
        if(!storyAnchored)continue;
        const minimumScore=(titleAnchor.count>=2||effectiveRel.entityShared>0||effectiveRel.numericMatch>0)?1:3;
        if(effectiveRel.score<minimumScore)continue;
        units.push({rawPassageIndex:pi,text:sentence,relevance:effectiveRel.score,topicOverlap:effectiveRel.topicOverlap,entityShared:effectiveRel.entityShared});
      }
    }
    const dedup=[]; const seen=new Set();
    for(const u of units.sort((a,b)=>b.relevance-a.relevance)){
      const key=u.text.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
      if(!key||seen.has(key))continue;
      if(dedup.some(x=>{
        const dedupThreshold=Math.min(4,Math.max(2,Math.floor(Math.min(x.text.length,u.text.length)/80)));
        return phraseOverlap(x.text,u.text)>=dedupThreshold;
      }))continue;
      seen.add(key);dedup.push(u);
    }
    const relevant=dedup.slice(0,48);
    const claims=relevant.filter(x=>FACTUAL.test(x.text)||numbers(x.text).size>0||/["“]/.test(x.text)).map((x,idx)=>({
      id:'C'+(allClaims.length+idx+1),
      sourceId:'S'+(si+1),
      passageIndex:x.rawPassageIndex+1,
      text:x.text,
      supportType:'direct-passage',
      relevanceScore:x.relevance,
      numbers:[...numbers(x.text)],
      attribution:/\b(?:according to|said|reported|told|announced|argued|noted|confirmed|denied)\b/i.test(x.text)
    }));
    allClaims.push(...claims);
    normalizedSources.push({...source,passages:relevant.map(x=>x.text),body:relevant.map(x=>x.text).join(' '),extraction:{...(source.extraction||{}),rawPassageCount:raw.length,relevantPassageCount:relevant.length,relevanceFiltered:true,relevantPassages:relevant.map((x,i)=>({id:'P'+(i+1),rawPassageIndex:x.rawPassageIndex+1,text:x.text,score:x.relevance}))}});
  }
  const uniqueClaims=[]; const claimSeen=new Set();
  for(const claim of allClaims){const key=claim.text.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();if(!key||claimSeen.has(key))continue;claimSeen.add(key);uniqueClaims.push({...claim,id:'C'+(uniqueClaims.length+1)});}
  const relevantPassageCount=normalizedSources.reduce((n,s)=>n+s.passages.length,0);
  const relevantChars=normalizedSources.reduce((n,s)=>n+s.body.length,0);
  const rawChars=sources.reduce((n,s)=>n+String(s.body||s.passages?.join(' ')||'').length,0);
  const independentSourceCount=normalizedSources.length;
  const publisherFamilies=[...new Set(normalizedSources.map(s=>s.publisherFamily).filter(Boolean))];
  const density=rawPassageCount?Number((relevantPassageCount/rawPassageCount).toFixed(3)):0;
  const evidenceCapacity=uniqueClaims.length>=18&&relevantChars>=7000&&substantiveSourceCount>=2?'high':uniqueClaims.length>=9&&relevantChars>=3500&&substantiveSourceCount>=2?'medium':uniqueClaims.length>=3&&relevantChars>=1200&&substantiveSourceCount>=1?'low':'none';
  const contradictions=[];
  for(let i=0;i<uniqueClaims.length;i++)for(let j=i+1;j<uniqueClaims.length;j++)if(uniqueClaims[i].sourceId!==uniqueClaims[j].sourceId&&contradiction(uniqueClaims[i].text,uniqueClaims[j].text))contradictions.push({claims:[uniqueClaims[i].id,uniqueClaims[j].id],texts:[uniqueClaims[i].text,uniqueClaims[j].text]});
  const uncertainty=[];
  if(publisherFamilies.length<2)uncertainty.push('No independent second publisher family established.');
  if(density<0.25)uncertainty.push('Low relevant-evidence density; source pages contain substantial non-story material.');
  if(uniqueClaims.length<4)uncertainty.push('Few directly supported factual claims were extracted.');
  if(contradictions.length)uncertainty.push('Conflicting claim signals were detected across source material.');
  const unknowns=[];
  if(!normalizedSources.some(s=>s.primary===true))unknowns.push('No primary-source material established in the evidence brief.');
  if(!uniqueClaims.some(c=>c.numbers.length))unknowns.push('No supported numeric detail extracted.');
  return {
    version:3,
    storyCapacity:evidenceCapacity,
    coreStoryFacts:uniqueClaims.slice(0,24).map(c=>({claimId:c.id,sourceId:c.sourceId,text:c.text})),
    supportedClaims:uniqueClaims.slice(0,48),
    sourceSupportMapping:uniqueClaims.slice(0,48).map(c=>({claimId:c.id,sourceId:c.sourceId,passageIndex:c.passageIndex})),
    relevantPassages:normalizedSources.flatMap((s,si)=>s.passages.map((text,pi)=>({sourceId:'S'+(si+1),passageId:'P'+(pi+1),text}))),
    uncertainty,
    unknowns,
    contradictions,
    metrics:{rawPassageCount,relevantPassageCount,supportedClaimCount:Math.min(48,uniqueClaims.length),independentSourceCount,publisherFamilyCount:publisherFamilies.length,substantiveSourceCount,sourceEvidenceMetrics,relevantEvidenceDensity:density,rawChars,relevantChars,evidenceCapacity},
    sources:normalizedSources
  };
}
