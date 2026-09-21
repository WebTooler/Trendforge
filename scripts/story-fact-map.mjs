const clean=(s='')=>String(s).replace(/\s+/g,' ').trim();
const stop=new Set('about after again also been being could from have into more most over said some than that their there these they this what when which with will would your technology tech digital latest news article articles story stories report reports reported according development developments company companies industry'.split(' '));
const tokens=t=>new Set(clean(t).toLowerCase().replace(/[^a-z0-9]+/g,' ').split(/\s+/).filter(w=>w.length>=4&&!stop.has(w)));
const overlap=(a,b)=>{const A=tokens(a),B=tokens(b),shared=[...A].filter(x=>B.has(x));return{shared,count:shared.length,coverage:shared.length/Math.max(1,A.size)};};
const phraseOverlap=(a,b)=>{const words=x=>clean(x).toLowerCase().replace(/[^a-z0-9]+/g,' ').split(/\s+/).filter(Boolean);const grams=x=>{const s=new Set();for(let i=0;i<x.length-1;i++)s.add(x[i]+' '+x[i+1]);return s};const A=grams(words(a)),B=grams(words(b));return[...A].filter(x=>B.has(x)).length;};
const sourceRole=({candidate={},source={}}={})=>{
  if(source.primary===true)return 'PRIMARY';
  const title=overlap(source.title||'',candidate.title||'');
  const body=overlap((source.passages||[]).slice(0,8).join(' '),candidate.title||'');
  if(title.count>=3||title.coverage>=0.55)return 'DIRECT_REPORTING';
  if(title.count>=1||body.count>=2)return 'CORROBORATION';
  return 'CONTEXT';
};
function buildStoryFactMap({candidate={},sources=[],evidenceBrief=null}={}){
  const claims=Array.isArray(evidenceBrief?.supportedClaims)?evidenceBrief.supportedClaims:[];
  const sourceById=new Map((sources||[]).map((s,i)=>[s.id||'S'+(i+1),s]));
  const facts=claims.map((claim,index)=>{
    const source=sourceById.get(claim.sourceId)||{};
    const role=source.sourceRole||sourceRole({candidate,source});
    const titleRel=overlap(claim.text,candidate.title||'');
    const descRel=overlap(claim.text,candidate.description||'');
    const specificity=Number(claim.relevanceScore||0)+Math.min(4,Number(claim.entityShared||0)*2)+Math.min(3,Number(claim.numbers?.length||0));
    const core=(role==='PRIMARY'||role==='DIRECT_REPORTING')
      ? (titleRel.count>=1||descRel.count>=2||Number(claim.relevanceScore||0)>=6)
      : (role==='CORROBORATION'&&(titleRel.count>=2||Number(claim.relevanceScore||0)>=8));
    return {
      factId:'F'+(index+1),
      claimId:claim.id,
      sourceId:claim.sourceId,
      sourceRole:role,
      passageIndex:claim.passageIndex,
      text:clean(claim.text),
      attribution:claim.attribution===true,
      numbers:Array.isArray(claim.numbers)?claim.numbers:[],
      core,
      specificityScore:specificity,
      titleOverlap:titleRel.count,
      descriptionOverlap:descRel.count
    };
  }).filter(x=>x.text);
  const dedup=[];
  for(const fact of facts){
    const duplicate=dedup.find(x=>phraseOverlap(x.text,fact.text)>=2);
    if(duplicate){
      if(fact.core&&!duplicate.core)Object.assign(duplicate,{core:true});
      continue;
    }
    dedup.push(fact);
  }
  const coreFacts=dedup.filter(x=>x.core);
  const directSourceIds=new Set((sources||[]).map((s,i)=>({id:s.id||'S'+(i+1),role:s.sourceRole||sourceRole({candidate,source:s})})).filter(x=>x.role==='PRIMARY'||x.role==='DIRECT_REPORTING').map(x=>x.id));
  for(const fact of dedup){ if(!fact.core && directSourceIds.has(fact.sourceId) && (fact.titleOverlap>=1 || fact.descriptionOverlap>=1)) fact.core=true; }
  const finalCoreFacts=dedup.filter(x=>x.core);
  const contextFacts=dedup.filter(x=>!x.core);
  const coreSourceIds=[...new Set(finalCoreFacts.map(x=>x.sourceId))];
  const coreRoles=[...new Set(finalCoreFacts.map(x=>x.sourceRole))];
  const coreChars=finalCoreFacts.reduce((n,x)=>n+x.text.length,0);
  const directCoreFacts=finalCoreFacts.filter(x=>x.sourceRole==='PRIMARY'||x.sourceRole==='DIRECT_REPORTING');
  const gaps=[];
  if(finalCoreFacts.length<4)gaps.push('fewer-than-four-core-facts');
  if(directCoreFacts.length<3)gaps.push('insufficient-direct-story-facts');
  if(coreChars<700)gaps.push('low-core-fact-character-capacity');
  if(coreSourceIds.length===0)gaps.push('no-core-source');
  if(finalCoreFacts.length&&coreRoles.every(r=>r==='CONTEXT'))gaps.push('core-facts-are-context-only');
  const claimCapacity=Math.max(0,Math.min(18,finalCoreFacts.length));
  const wordCapacity=Math.floor(coreChars/4.2);
  let level='none';
  if(finalCoreFacts.length>=10&&coreChars>=3500)level='high';
  else if(finalCoreFacts.length>=6&&coreChars>=2200)level='medium';
  else if(finalCoreFacts.length>=4&&coreChars>=1000)level='low';
  return {
    version:1,
    story:{title:clean(candidate.title),description:clean(candidate.description)},
    sourceRoles:[...new Set((sources||[]).map((s,i)=>({id:s.id||'S'+(i+1),role:s.sourceRole||sourceRole({candidate,source:s})})))],
    facts:dedup,
    coreFacts:finalCoreFacts,
    contextFacts,
    gaps,
    capacity:{level,coreFactCount:coreFacts.length,coreFactChars:coreChars,directCoreFactCount:directCoreFacts.length,coreSourceCount:coreSourceIds.length,maxFactualClaims:claimCapacity,maxSupportedWords:Math.max(0,Math.min(900,wordCapacity))},
    policy:{coreFactsOnlyForCoreNarrative:true,contextCannotCompensateForCore:true,sourceRoleRequired:true,claimToFactMappingRequired:true}
  };
}
export { buildStoryFactMap, sourceRole };
