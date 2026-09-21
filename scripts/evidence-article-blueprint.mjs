function clamp(n,min,max){return Math.max(min,Math.min(max,n));}

export function deriveEvidenceArticleBlueprint(coverage={}) {
  const band=coverage.band||'insufficient';
  const brief=coverage.evidenceBrief||null;
  const factMap=brief?.storyFactMap||null;
  const sourceCount=Number(coverage.sourceCount||0);
  const passages=Number(coverage.totalPassages||0);
  const chars=Number(coverage.totalChars||0);
  const families=Number(coverage.independentPublisherFamilies||0);
  const coreFacts=Number(factMap?.capacity?.coreFactCount||0);
  const coreChars=Number(factMap?.capacity?.coreFactChars||0);
  const maxSupportedWords=Number(factMap?.capacity?.maxSupportedWords||0);
  const claimCapacity=Number(factMap?.capacity?.maxFactualClaims||0);
  const synthesis=factMap?.capacity?.synthesisCapacity||{allowed:false,maxWords:0,maxStatements:0,allowedFactIds:[]};
  const capacity=band==='rich' ? 'high' : band==='usable' ? 'medium' : band==='thin' ? 'low' : 'none';
  const evidenceCapacity={sourceCount,independentFamilies:families,totalPassages:passages,totalChars:chars,level:capacity,rawPassageCount:Number(coverage.rawPassageCount||passages),relevantPassageCount:Number(coverage.relevantPassageCount||passages),supportedClaimCount:Number(coverage.supportedClaimCount||brief?.metrics?.supportedClaimCount||0),relevantEvidenceDensity:Number(coverage.relevantEvidenceDensity||brief?.metrics?.relevantEvidenceDensity||0),coreFactCount:coreFacts,coreFactChars:coreChars,maxSupportedWords,maxFactualClaims:claimCapacity};
  const boundedMax=Math.max(0,Math.min(1100,maxSupportedWords||0));
  if(maxSupportedWords>0&&maxSupportedWords<220) return {version:3,mode:'blocked',targetWords:{min:0,max:0,soft:0},h2Guidance:{preferredMin:0,preferredMax:0,writerDecides:false,noPadding:true},maxH2:0,requireCrossCheck:false,allowContextSection:false,sectionPlan:[],evidenceCapacity,instructions:['Do not generate a publishable article. Core story fact capacity is below the safe minimum.']};
  if (band==='rich' && coverage.readyForRichArticle===true) {
    const maxH2=clamp(3+Math.floor(Math.min(sourceCount,4)/2),3,5);
    const minWords=Math.min(650,Math.max(280,Math.floor(boundedMax*0.60)));
    const maxWords=Math.max(minWords,Math.min(1000,boundedMax||1000));
    return {version:3,mode:'rich',targetWords:{min:minWords,max:maxWords,soft:Math.round((minWords+maxWords)/2)},h2Guidance:{preferredMin:3,preferredMax:maxH2,writerDecides:true,noPadding:true},maxH2,requireCrossCheck:sourceCount>=2,allowContextSection:true,sectionPlan:['development','evidence/details','implications/context','limitations/uncertainty','evidence-backed synthesis'],synthesis:{...synthesis,heading:'What the Evidence Shows'},evidenceCapacity,instructions:['Use only evidence-supported sections.','Let core fact capacity determine depth; never pad to the word or H2 target.','Cross-check material claims when multiple independent families are available.']};
  }
  if (band==='usable' && coverage.readyForRichArticle===true) {
    const maxH2=clamp(2+Math.floor(Math.min(sourceCount,4)/2),2,4);
    const minWords=Math.min(425,Math.max(240,Math.floor(boundedMax*0.60)));
    const maxWords=Math.max(minWords,Math.min(750,boundedMax||750));
    return {version:3,mode:'bounded',targetWords:{min:minWords,max:maxWords,soft:Math.round((minWords+maxWords)/2)},h2Guidance:{preferredMin:2,preferredMax:maxH2,writerDecides:true,noPadding:true},maxH2,requireCrossCheck:sourceCount>=2,allowContextSection:false,sectionPlan:['development','evidence/details','implications or limitations','evidence-backed synthesis'],synthesis:{...synthesis,heading:'What the Evidence Shows'},evidenceCapacity,instructions:['Keep scope bounded by the supplied core facts.','Prefer distinct sections with concrete evidence over generic context.','Do not create a context section unless the evidence supports it.']};
  }
  if (band==='thin') {
    const capacityWords=Math.max(0,Math.min(420,boundedMax||0));
    if(capacityWords<220)return {version:3,mode:'blocked',targetWords:{min:0,max:0,soft:0},h2Guidance:{preferredMin:0,preferredMax:0,writerDecides:false,noPadding:true},maxH2:0,requireCrossCheck:false,allowContextSection:false,sectionPlan:[],evidenceCapacity,instructions:['Do not generate a publishable article. Core story evidence cannot support a safe minimum depth.']};
    const minimumWords=Math.min(280,Math.max(220,Math.floor(capacityWords*0.55)));
    const maximumWords=Math.max(minimumWords,capacityWords);
    return {version:3,mode:'narrow',targetWords:{min:minimumWords,max:maximumWords,soft:Math.round((minimumWords+maximumWords)/2)},h2Guidance:{preferredMin:1,preferredMax:synthesis.allowed?2:1,writerDecides:true,noPadding:true},maxH2:synthesis.allowed?2:1,requireCrossCheck:false,allowContextSection:false,sectionPlan:['development','supported detail',...(synthesis.allowed?['evidence-backed synthesis']:[])],synthesis:{...synthesis,heading:'What the Evidence Shows'},evidenceCapacity,instructions:['Stay narrow and factual.','Use only core story facts first; context facts cannot compensate for missing core facts.','Do not infer missing context.','Do not exceed the supported factual claim budget.'],claimBudget:{maxFactualClaims:claimCapacity}};
  }
  return {version:3,mode:'blocked',targetWords:{min:0,max:0,soft:0},h2Guidance:{preferredMin:0,preferredMax:0,writerDecides:false,noPadding:true},maxH2:0,requireCrossCheck:false,allowContextSection:false,sectionPlan:[],evidenceCapacity,instructions:['Do not generate a publishable article. Evidence is insufficient; obtain more evidence first.']};
}
