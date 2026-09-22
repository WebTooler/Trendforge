export function anchorClaimProvenance({provenanceFacts=[],coreFactMatch=null,best=null}) {
  const facts=Array.isArray(provenanceFacts)?provenanceFacts.filter(f=>f&&typeof f.text==='string'&&f.text.trim()):[];
  if(facts.length>1){
    return {
      text:facts.map(f=>f.text).join(' '),
      passageId:facts.map(f=>f.passageId||`${f.sourceId}-P${f.passageIndex}`).join(','),
      source:'fact-map'
    };
  }
  if(facts.length===1){
    const f=facts[0];
    return {
      text:f.text,
      passageId:f.passageId||`${f.sourceId}-P${f.passageIndex}`,
      source:'fact-map'
    };
  }
  if(coreFactMatch&&typeof coreFactMatch.text==='string'&&coreFactMatch.text.trim()){
    return {
      text:coreFactMatch.text,
      passageId:coreFactMatch.passageId||`${coreFactMatch.sourceId}-P${coreFactMatch.passageIndex}`,
      source:'fact-map'
    };
  }
  return {
    text:String(best?.bestPassage||''),
    passageId:best?.bestPassageId||null,
    source:'semantic-fallback'
  };
}
