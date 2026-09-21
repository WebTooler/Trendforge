function clamp(n,min,max){return Math.max(min,Math.min(max,n));}

export function deriveEvidenceArticleBlueprint(coverage={}) {
  const band=coverage.band||'insufficient';
  const brief=coverage.evidenceBrief||null;
  const sourceCount=Number(coverage.sourceCount||0);
  const passages=Number(coverage.totalPassages||0);
  const chars=Number(coverage.totalChars||0);
  const families=Number(coverage.independentPublisherFamilies||0);
  const capacity=band==='rich' ? 'high' : band==='usable' ? 'medium' : band==='thin' ? 'low' : 'none';
  const evidenceCapacity={sourceCount,independentFamilies:families,totalPassages:passages,totalChars:chars,level:capacity,rawPassageCount:Number(coverage.rawPassageCount||passages),relevantPassageCount:Number(coverage.relevantPassageCount||passages),supportedClaimCount:Number(coverage.supportedClaimCount||brief?.metrics?.supportedClaimCount||0),relevantEvidenceDensity:Number(coverage.relevantEvidenceDensity||brief?.metrics?.relevantEvidenceDensity||0)};
  if (band==='rich' && coverage.readyForRichArticle===true) {
    const maxH2=clamp(3+Math.floor(Math.min(sourceCount,4)/2),3,5);
    return {version:2,mode:'rich',targetWords:{min:650,max:1000,soft:800},h2Guidance:{preferredMin:3,preferredMax:maxH2,writerDecides:true,noPadding:true},maxH2,requireCrossCheck:sourceCount>=2,allowContextSection:true,sectionPlan:['development','evidence/details','implications/context','limitations/uncertainty','supported next step'],evidenceCapacity,instructions:['Use only evidence-supported sections.','Let evidence capacity determine depth; never pad to the word or H2 target.','Cross-check material claims when multiple independent families are available.']};
  }
  if (band==='usable' && coverage.readyForRichArticle===true) {
    const maxH2=clamp(2+Math.floor(Math.min(sourceCount,4)/2),2,4);
    return {version:2,mode:'bounded',targetWords:{min:425,max:750,soft:600},h2Guidance:{preferredMin:2,preferredMax:maxH2,writerDecides:true,noPadding:true},maxH2,requireCrossCheck:sourceCount>=2,allowContextSection:false,sectionPlan:['development','evidence/details','implications or limitations'],evidenceCapacity,instructions:['Keep scope bounded by the supplied evidence.','Prefer distinct sections with concrete evidence over generic context.','Do not create a context section unless the evidence supports it.']};
  }
  if (band==='thin') {
    const evidenceWords=Math.floor(chars/4.5);
    const claimCapacity=Number(coverage.supportedClaimCount||0);
    const minimumWords=Math.max(220,Math.min(300,evidenceWords));
    const maximumWords=Math.max(minimumWords,Math.min(420,evidenceWords+80));
    return {version:2,mode:'narrow',targetWords:{min:minimumWords,max:maximumWords,soft:Math.round((minimumWords+maximumWords)/2)},h2Guidance:{preferredMin:1,preferredMax:2,writerDecides:true,noPadding:true},maxH2:2,requireCrossCheck:false,allowContextSection:false,sectionPlan:['development','supported detail'],evidenceCapacity,instructions:['Stay narrow and factual.','Use only the strongest supported details.','Do not infer missing context.','Do not exceed the supported factual claim budget.'],claimBudget:{maxFactualClaims:Math.max(3,claimCapacity)}};
  }
  return {version:2,mode:'blocked',targetWords:{min:0,max:0,soft:0},h2Guidance:{preferredMin:0,preferredMax:0,writerDecides:false,noPadding:true},maxH2:0,requireCrossCheck:false,allowContextSection:false,sectionPlan:[],evidenceCapacity,instructions:['Do not generate a publishable article. Evidence is insufficient; obtain more evidence first.']};
}
