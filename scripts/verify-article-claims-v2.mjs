import fs from 'node:fs';

const briefPath='data/article-brief.json';
const articleDir='content/articles';
const out='data/claim-verification.json';

const STOP=new Set([
  'about','after','again','also','been','being','could','from','have','into','more','most','over','said','some','than','that','their','there','these','they','this','what','when','which','with','will','would','your',
  'technology','tech','digital','latest','news','update','updates','guide','how','today','artificial','intelligence','company','companies','industry','development','developments','according','reported','reports','working','works','story','stories','article','articles','readers','users',
  'because','while','where','whose','which','through','after','before','between','under','over','using','used','uses','make','makes','made','more','less','than','then','also','still','already','now','just','even','only','often','usually','including','another','around'
]);

// Normalize common editorial paraphrases without pretending that broad topical similarity is factual support.
const ALIAS=new Map([
  ['bitcoin','btc'],['bitcoins','btc'],['ethereum','eth'],['ether','eth'],['cryptocurrency','crypto'],['cryptocurrencies','crypto'],
  ['declined','fall'],['declines','fall'],['dropped','fall'],['drops','fall'],['fell','fall'],['sliding','fall'],['slide','fall'],['down','fall'],
  ['gained','rise'],['gains','rise'],['increased','rise'],['increases','rise'],['rose','rise'],['rising','rise'],['up','rise'],
  ['regulator','regulatory'],['regulators','regulatory'],['watchdog','regulatory'],['authority','regulatory'],['authorities','regulatory'],
  ['probe','investigation'],['probes','investigation'],['inquiry','investigation'],['inquiries','investigation'],['investigating','investigation'],
  ['escalated','escalate'],['expanded','escalate'],['intensified','escalate'],
  ['warranty','guarantee'],['warranties','guarantee'],['terms','conditions'],['term','conditions'],['customers','consumer'],['customer','consumer'],
  ['announced','announce'],['announces','announce'],['announcing','announce'],['launched','launch'],['launches','launch'],['released','release'],['releases','release'],['unveiled','reveal'],
  ['raised','raise'],['raising','raise'],['funding','fund'],['investment','invest'],['invested','invest'],['investor','invest'],['investors','invest'],
  ['partnership','partner'],['partnerships','partner'],['acquisition','acquire'],['acquired','acquire'],['acquiring','acquire'],
  ['headquartered','base'],['headquarters','base'],['secured','secure'],['secures','secure'],['backed','support'],['backing','support'],
  ['model','models'],['models','models'],['openweight','open-weight'],['open','open'],['weight','weight'],
  ['sovereign','sovereign'],['frontier','frontier'],['artificial','ai'],['intelligence','ai']
]);

const tok=w=>{
  const x=String(w).toLowerCase().trim();
  if(!x)return '';
  if(ALIAS.has(x))return ALIAS.get(x);
  // Keep short technical/entity tokens; stem only ordinary long words.
  if(x.length<=4)return x;
  return x.replace(/(ingly|edly|ing|ed|es|s)$/,'')||x;
};

const tokenize=text=>new Set(
  String(text).toLowerCase()
    .replace(/[^a-z0-9]+/g,' ')
    .split(/\s+/)
    .map(tok)
    .filter(w=>w.length>=3&&!STOP.has(w))
);
const arr=text=>[...tokenize(text)];
const nums=text=>new Set((String(text).match(/\b\d+(?:[.,]\d+)?(?:%|bn|b|m|k)?\b/gi)||[]).map(x=>x.toLowerCase().replace(/,/g,'')));
const ngrams=(text,n=2)=>{
  const a=arr(text),out=new Set();
  for(let i=0;i<=a.length-n;i++)out.add(a.slice(i,i+n).join(' '));
  return out;
};
const sentences=text=>String(text).replace(/\s+/g,' ').split(/(?<=[.!?])\s+(?=[A-Z0-9"“])/).map(s=>s.trim()).filter(s=>s.length>=35&&s.length<=700);
const factualClaim=s=>{
  const x=s.trim();
  if(/^(the move|this move|this development|the development|the change|the situation|that could|this could|it could|it may|this may|for readers|for users|in practice|overall|the broader|the key|the takeaway|this means|that means)\b/i.test(x))return false;
  return /\b(announced|launch(?:ed|es)?|released|reported|said|plans?|expects?|found|shows?|calls?|proposed|approved|blocked|investigation|probe|inquiry|regulator|regulatory|warranty|terms|price|percent|%|million|billion|year|month|today|yesterday|202[0-9])\b/i.test(x)||/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/.test(x);
};
const cleanBody=raw=>raw.replace(/^---[\s\S]*?---/,'').replace(/^\s*##\s+Sources[\s\S]*$/i,'').trim();
const titleFrom=raw=>(raw.match(/^title:\s*"([\s\S]*?)"\s*$/m)?.[1]||'').trim();
const normalizeNumber=n=>String(n).replace(/,/g,'').replace(/\.0+$/,'');
const entityTerms=text=>{
  const words=String(text).match(/\b(?:[A-Z][A-Za-z0-9&.-]*)(?:\s+[A-Z][A-Za-z0-9&.-]*){0,3}\b/g)||[];
  return new Set(words.map(x=>x.toLowerCase()).filter(x=>x.length>=3&&!STOP.has(x)));
};
const hasNegation=text=>/\b(no|not|never|without|unlikely|denied|denies|deny|didn't|doesn't|isn't|wasn't|weren't|cannot|can't|failed|fails|blocked)\b/i.test(String(text));

// Evidence-aware scoring: lexical overlap remains the auditable base, but source title + passage
// are treated as one evidence unit and multiple passages may jointly support a claim. Numeric and
// entity constraints remain hard safeguards so loosening paraphrase matching cannot create a false pass.
const score=(claim,evidence)=>{
  const A=tokenize(claim),B=tokenize(evidence),shared=[...A].filter(x=>B.has(x));
  const phr=[...ngrams(claim,2)].filter(x=>ngrams(evidence,2).has(x));
  const Acount=Math.max(1,A.size),coverage=shared.length/Acount;
  const phraseScore=Math.min(1,phr.length/3);
  const cn=nums(claim),en=nums(evidence);
  const numericMismatch=[...cn].some(n=>!en.has(normalizeNumber(n)));
  const ce=entityTerms(claim),ee=entityTerms(evidence),entityShared=[...ce].filter(x=>ee.has(x));
  const negationMismatch=hasNegation(claim)!==hasNegation(evidence)&&(/[.!?]/.test(claim)&&/\b(deny|denied|not|without|failed|fails|blocked)\b/i.test(evidence));
  const anchorScore=Math.min(1,shared.length/Math.max(2,Math.min(8,Acount)));
  let s=coverage*62+phraseScore*18+anchorScore*10;
  if(entityShared.length)s+=Math.min(8,entityShared.length*4);
  if(shared.length>=5)s+=5;
  if(numericMismatch)s-=55;
  if(negationMismatch)s-=30;
  return{score:Math.max(0,Math.min(100,Math.round(s))),coverage,shared:shared.slice(0,20),phrases:phr.slice(0,8),entityShared:entityShared.slice(0,8),numericMismatch,negationMismatch};
};

const write=result=>{fs.mkdirSync('data',{recursive:true});fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');};

async function main(){
  if(!fs.existsSync(articleDir)){console.log('No generated article; claim verification skipped.');return;}
  const files=fs.readdirSync(articleDir).filter(f=>f.endsWith('.md')).sort((a,b)=>fs.statSync(`${articleDir}/${b}`).mtimeMs-fs.statSync(`${articleDir}/${a}`).mtimeMs);
  if(!files.length){console.log('No generated article; claim verification skipped.');return;}

  const articlePath=`${articleDir}/${files[0]}`;
  const raw=fs.readFileSync(articlePath,'utf8');
  const articleTitle=titleFrom(raw);
  const brief=fs.existsSync(briefPath)?JSON.parse(fs.readFileSync(briefPath,'utf8')):null;
  const briefTitle=brief?.brief?.title||'';
  const overlap=[...tokenize(articleTitle)].filter(x=>tokenize(briefTitle).has(x)).length;
  if(briefTitle&&articleTitle&&overlap<2){console.log(`No matching generated article for current brief; latest article is '${articleTitle}'. Claim verification skipped safely.`);return;}

  const claims=sentences(cleanBody(raw)).filter(factualClaim).slice(0,30);
  const grounding=brief?.grounding?.sources||[];
  // Include source/article title with every passage. This fixes a common false-negative where
  // the passage contains "the company" while the headline carries the entity/topic name.
  const passages=grounding.flatMap(s=>(s.passages||[]).map(p=>({
    text:`${s.title||''}. ${p}`,
    source:s.title||s.url,
    url:s.url
  }))).filter(x=>x.text&&x.text.length>=40);

  if(!passages.length){
    const result={version:10,generatedAt:new Date().toISOString(),articlePath,verificationMode:'shared-grounding-pack-v10',sourceCount:0,usableSourceCount:0,claimCount:claims.length,verified:0,partial:0,unsupported:claims.length,sourceUnavailable:0,averageConfidence:0,pass:false,policy:{verifiedMin:60,partialMin:45,blockUnsupported:true,minimumAverageConfidence:60},reason:'Generated article had no shared grounding passages.'};
    write(result);console.log(`Claim Verification v10: ${claims.length} claim(s) — BLOCK (no shared grounding passages).`);process.exit(1);
  }

  const results=claims.map((claim,index)=>{
    const matches=passages.map(p=>({...score(claim,p.text),source:p.source,url:p.url,evidence:p.text.slice(0,900)})).sort((a,b)=>b.score-a.score);
    const best=matches[0];
    const second=matches[1];
    const topTwo=matches.slice(0,2);
    const combinedEvidence=topTwo.map(x=>x.evidence).join(' ');
    const combined=score(claim,combinedEvidence);
    const cn=nums(claim);
    const combinedNumericMismatch=[...cn].some(n=>!nums(combinedEvidence).has(normalizeNumber(n)));
    const strongSingle=best&&best.score>=62&&!best.numericMismatch&&!best.negationMismatch;
    const strongCombined=combined.score>=58&&!combined.numericMismatch&&!combined.negationMismatch&&combined.shared.length>=3;
    const entityRequired=entityTerms(claim).size>0;
    const entitySupported=!entityRequired||Boolean(best?.entityShared?.length||combined.entityShared?.length);
    const effective=Math.max(best?.score||0,combined.score);
    const verified=(strongSingle||strongCombined)&&entitySupported&&!combinedNumericMismatch;
    const partial=!verified&&effective>=45&&!combinedNumericMismatch&&entitySupported;
    const status=verified?'verified':partial?'partial':'unsupported';
    return{
      index:index+1,claim,status,confidence:effective,
      bestSource:best?.source||null,
      evidence:best?.evidence||'',
      supportingSources:[...new Set(topTwo.filter(x=>x.score>=45).map(x=>x.source))].slice(0,2),
      sharedTerms:best?.shared||[],
      entityShared:best?.entityShared||combined.entityShared||[],
      numericMismatch:Boolean(best?.numericMismatch||combinedNumericMismatch),
      negationMismatch:Boolean(best?.negationMismatch||combined.negationMismatch),
      matchingMode:strongSingle?'single-evidence':strongCombined?'multi-evidence':'insufficient-evidence'
    };
  });

  const verified=results.filter(x=>x.status==='verified').length;
  const partial=results.filter(x=>x.status==='partial').length;
  const unsupported=results.filter(x=>x.status==='unsupported').length;
  const avg=results.length?Math.round(results.reduce((n,x)=>n+x.confidence,0)/results.length):0;
  const pass=claims.length>0&&unsupported===0&&avg>=60;
  const result={
    version:10,generatedAt:new Date().toISOString(),articlePath,verificationMode:'shared-grounding-pack-v10',
    sourceCount:new Set(passages.map(x=>x.url)).size,usableSourceCount:new Set(passages.map(x=>x.url)).size,
    claimCount:claims.length,verified,partial,unsupported,sourceUnavailable:0,averageConfidence:avg,pass,
    policy:{verifiedMin:62,partialMin:45,blockUnsupported:true,minimumAverageConfidence:60,numericMismatchAlwaysBlocks:true,entitySupportRequired:true,multiEvidenceSupport:true},
    claims:results
  };
  write(result);
  console.log(`Claim Verification v10: ${claims.length} claim(s) — ${verified} verified, ${partial} partial, ${unsupported} unsupported, 0 source-unavailable; average confidence ${avg}; ${pass?'PASS':'BLOCK (shared-grounding-evidence)'}.`);
  if(!pass)process.exit(1);
}

main().catch(e=>{console.error(`Claim verification failed unexpectedly: ${e?.message||String(e)}`);process.exit(1);});
