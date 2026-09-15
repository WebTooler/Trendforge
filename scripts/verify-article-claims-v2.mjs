import fs from 'node:fs';

const briefPath='data/article-brief.json';
const articleDir='content/articles';
const out='data/claim-verification.json';

const STOP=new Set([
  'about','after','again','also','been','being','could','from','have','into','more','most','over','said','some','than','that','their','there','these','they','this','what','when','which','with','will','would','your',
  'technology','tech','digital','latest','news','update','updates','guide','how','today','artificial','intelligence','company','companies','industry','development','developments','according','reported','reports','working','works','story','stories','article','articles','readers','users',
  'because','while','where','whose','which','through','after','before','between','under','over','using','used','uses','make','makes','made','more','less','than','then','also','still','already','now','just','even','only','often','usually','including','another','around','really','very','much','many','somewhat','generally'
]);

// Controlled semantic normalization. These are narrow factual paraphrase families, not generic
// similarity, so the verifier can recognize wording changes without treating topical similarity as proof.
const ALIAS=new Map([
  ['bitcoin','btc'],['bitcoins','btc'],['ethereum','eth'],['ether','eth'],['cryptocurrency','crypto'],['cryptocurrencies','crypto'],
  ['declined','fall'],['declines','fall'],['dropped','fall'],['drops','fall'],['fell','fall'],['sliding','fall'],['slide','fall'],['down','fall'],['falling','fall'],['falls','fall'],
  ['gained','rise'],['gains','rise'],['increased','rise'],['increases','rise'],['rose','rise'],['rising','rise'],['up','rise'],['increase','rise'],['increasing','rise'],
  ['worry','fear'],['worried','fear'],['worries','fear'],['fears','fear'],['feared','fear'],['concern','fear'],['concerns','fear'],['concerned','fear'],['anxious','fear'],['anxiety','fear'],
  ['losing','lose'],['lost','lose'],['loss','lose'],['replace','obsolete'],['replaced','obsolete'],['replacing','obsolete'],['replacement','obsolete'],['obsolete','obsolete'],
  ['worker','worker'],['workers','worker'],['employee','worker'],['employees','worker'],['staff','worker'],['workforce','worker'],['employment','job'],['employed','job'],['jobs','job'],['job','job'],
  ['survey','survey'],['surveys','survey'],['poll','survey'],['polls','survey'],['research','research'],['researches','research'],['study','research'],['studies','research'],
  ['share','share'],['shares','share'],['portion','share'],['percentage','percent'],['percentages','percent'],['points','point'],['point','point'],
  ['rise','rise'],['raised','raise'],['raising','raise'],['funding','fund'],['investment','invest'],['invested','invest'],['investor','invest'],['investors','invest'],
  ['regulator','regulatory'],['regulators','regulatory'],['watchdog','regulatory'],['authority','regulatory'],['authorities','regulatory'],
  ['probe','investigation'],['probes','investigation'],['inquiry','investigation'],['inquiries','investigation'],['investigating','investigation'],
  ['escalated','escalate'],['expanded','escalate'],['intensified','escalate'],
  ['warranty','guarantee'],['warranties','guarantee'],['terms','conditions'],['term','conditions'],['customers','consumer'],['customer','consumer'],
  ['announced','announce'],['announces','announce'],['announcing','announce'],['launched','launch'],['launches','launch'],['released','release'],['releases','release'],['unveiled','reveal'],
  ['partnership','partner'],['partnerships','partner'],['acquisition','acquire'],['acquired','acquire'],['acquiring','acquire'],
  ['headquartered','base'],['headquarters','base'],['secured','secure'],['secures','secure'],['backed','support'],['backing','support'],
  ['model','models'],['models','models'],['openweight','open-weight'],['sovereign','sovereign'],['frontier','frontier'],['artificial','ai'],['intelligence','ai']
]);

const tok=w=>{
  const x=String(w).toLowerCase().trim();
  if(!x)return '';
  if(ALIAS.has(x))return ALIAS.get(x);
  if(x.length<=4)return x;
  return x.replace(/(ingly|edly|ing|ed|es|s)$/,'')||x;
};

const tokenize=text=>new Set(String(text).toLowerCase().replace(/[^a-z0-9]+/g,' ').split(/\s+/).map(tok).filter(w=>w.length>=3&&!STOP.has(w)));
const arr=text=>[...tokenize(text)];
const nums=text=>new Set((String(text).match(/\b\d+(?:[.,]\d+)?(?:%|bn|b|m|k)?\b/gi)||[]).map(x=>x.toLowerCase().replace(/,/g,'')));
const ngrams=(text,n=2)=>{const a=arr(text),out=new Set();for(let i=0;i<=a.length-n;i++)out.add(a.slice(i,i+n).join(' '));return out;};
const sentences=text=>String(text).replace(/\s+/g,' ').split(/(?<=[.!?])\s+(?=[A-Z0-9"“])/).map(s=>s.trim()).filter(s=>s.length>=35&&s.length<=700);
const factualClaim=s=>{
  const x=s.trim();
  if(/^(the move|this move|this development|the development|the change|the situation|that could|this could|it could|it may|this may|for readers|for users|in practice|overall|the broader|the key|the takeaway|this means|that means)\b/i.test(x))return false;
  return /\b(announced|launch(?:ed|es)?|released|reported|said|plans?|expects?|found|shows?|calls?|proposed|approved|blocked|investigation|probe|inquiry|regulator|regulatory|warranty|terms|price|percent|%|million|billion|year|month|today|yesterday|202[0-9]|survey|workers?|employees?|fear|worry|concern|jobs?|obsolete)\b/i.test(x)||/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/.test(x);
};
const cleanBody=raw=>raw.replace(/^---[\s\S]*?---/,'').replace(/^\s*##\s+Sources[\s\S]*$/i,'').trim();
const titleFrom=raw=>(raw.match(/^title:\s*"([\s\S]*?)"\s*$/m)?.[1]||'').trim();
const normalizeNumber=n=>String(n).replace(/,/g,'').replace(/\.0+$/,'');
const entityTerms=text=>{
  const words=String(text).match(/\b(?:[A-Z][A-Za-z0-9&.-]*)(?:\s+[A-Z][A-Za-z0-9&.-]*){0,3}\b/g)||[];
  return new Set(words.map(x=>x.toLowerCase()).filter(x=>x.length>=3&&!STOP.has(x)));
};
const hasNegation=text=>/\b(no|not|never|without|unlikely|denied|denies|deny|didn't|doesn't|isn't|wasn't|weren't|cannot|can't|failed|fails|blocked)\b/i.test(String(text));

// Score a claim against one complete grounded source unit. Multiple passages from the SAME source
// may jointly establish a claim; unrelated sources are never concatenated. Numeric/entity/negation
// safeguards remain hard constraints. The semantic families above only normalize close paraphrases.
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
  let s=coverage*58+phraseScore*14+anchorScore*10;
  if(entityShared.length)s+=Math.min(8,entityShared.length*4);
  if(shared.length>=5)s+=5;
  if(shared.length>=7)s+=5;
  if(numericMismatch)s-=60;
  if(negationMismatch)s-=35;
  return{score:Math.max(0,Math.min(100,Math.round(s))),coverage,shared,phrases:phr.slice(0,8),entityShared,numericMismatch,negationMismatch};
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

  // Build source-scoped evidence units. This is the key fix: a claim such as “the share rose
  // seven points to 27%” may require the number from one passage and the topic/entity from another
  // passage in the SAME publisher article. Combining different publishers would be unsafe.
  const sourceUnits=grounding.map((s,index)=>{
    const passages=(s.passages||[]).filter(p=>String(p).trim().length>=20);
    return{
      id:`S${index+1}`,
      source:s.title||s.url,
      url:s.url,
      text:[s.title||'',...passages].filter(Boolean).join('. '),
      passageCount:passages.length
    };
  }).filter(x=>x.text.length>=40);

  if(!sourceUnits.length){
    const result={version:11,generatedAt:new Date().toISOString(),articlePath,verificationMode:'source-scoped-semantic-grounding-v11',sourceCount:0,usableSourceCount:0,claimCount:claims.length,verified:0,partial:0,unsupported:claims.length,sourceUnavailable:0,averageConfidence:0,pass:false,policy:{verifiedMin:62,partialMin:45,blockUnsupported:true,minimumAverageConfidence:60,numericMismatchAlwaysBlocks:true,entitySupportRequired:true,multiEvidenceSupport:true,sourceScopedEvidence:true},reason:'Generated article had no shared grounding passages.'};
    write(result);console.log(`Claim Verification v11: ${claims.length} claim(s) — BLOCK (no shared grounding passages).`);process.exit(1);
  }

  const results=claims.map((claim,index)=>{
    const matches=sourceUnits.map(u=>({...score(claim,u.text),source:u.source,url:u.url,evidence:u.text.slice(0,1800),passageCount:u.passageCount})).sort((a,b)=>b.score-a.score);
    const best=matches[0];
    const second=matches[1];
    const cn=nums(claim);
    const combinedNumericMismatch=Boolean(best?.numericMismatch||([...cn].some(n=>!nums(best?.evidence||'').has(normalizeNumber(n)))));
    const entityRequired=entityTerms(claim).size>0;
    const entitySupported=!entityRequired||Boolean(best?.entityShared?.length);

    // A single source unit is allowed to aggregate its own passages, but there is no cross-source
    // score inflation. Strong support requires either high evidence coverage or several semantic anchors.
    const strongSingle=best&&best.score>=62&&!best.numericMismatch&&!best.negationMismatch;
    const strongMulti=best&&best.score>=58&&!best.numericMismatch&&!best.negationMismatch&&best.shared.length>=3&&best.entityShared.length>0;
    const effective=best?.score||0;
    const verified=(strongSingle||strongMulti)&&entitySupported&&!combinedNumericMismatch;
    const partial=!verified&&effective>=45&&!combinedNumericMismatch&&entitySupported;
    const status=verified?'verified':partial?'partial':'unsupported';
    return{
      index:index+1,claim,status,confidence:effective,
      bestSource:best?.source||null,
      evidence:best?.evidence||'',
      supportingSources:best&&best.score>=45?[best.source]:[],
      sharedTerms:(best?.shared||[]).slice(0,24),
      entityShared:(best?.entityShared||[]).slice(0,12),
      numericMismatch:Boolean(combinedNumericMismatch),
      negationMismatch:Boolean(best?.negationMismatch),
      matchingMode:strongSingle?'source-scoped-evidence':strongMulti?'source-scoped-semantic-evidence':'insufficient-evidence',
      sourcePassageCount:best?.passageCount||0
    };
  });

  const verified=results.filter(x=>x.status==='verified').length;
  const partial=results.filter(x=>x.status==='partial').length;
  const unsupported=results.filter(x=>x.status==='unsupported').length;
  const avg=results.length?Math.round(results.reduce((n,x)=>n+x.confidence,0)/results.length):0;
  const pass=claims.length>0&&unsupported===0&&avg>=60;
  const result={
    version:11,generatedAt:new Date().toISOString(),articlePath,verificationMode:'source-scoped-semantic-grounding-v11',
    sourceCount:sourceUnits.length,usableSourceCount:sourceUnits.length,
    claimCount:claims.length,verified,partial,unsupported,sourceUnavailable:0,averageConfidence:avg,pass,
    policy:{verifiedMin:62,partialMin:45,blockUnsupported:true,minimumAverageConfidence:60,numericMismatchAlwaysBlocks:true,entitySupportRequired:true,multiEvidenceSupport:true,sourceScopedEvidence:true,semanticNormalization:true},
    claims:results
  };
  write(result);
  console.log(`Claim Verification v11: ${claims.length} claim(s) — ${verified} verified, ${partial} partial, ${unsupported} unsupported, 0 source-unavailable; average confidence ${avg}; ${pass?'PASS':'BLOCK (source-scoped-grounding)'}.`);
  if(!pass)process.exit(1);
}

main().catch(e=>{console.error(`Claim verification failed unexpectedly: ${e?.message||String(e)}`);process.exit(1);});
