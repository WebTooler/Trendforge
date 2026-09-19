export function deriveEvidenceArticleBlueprint(coverage={}) {
  const band=coverage.band||'insufficient';
  const sourceCount=Number(coverage.sourceCount||0);

  if (band==='rich' && coverage.readyForRichArticle===true) {
    return {
      mode:'rich',
      targetWords:{min:700,max:1000,soft:850},
      h2Guidance:{preferredMin:3,preferredMax:5,writerDecides:true,noPadding:true},
      maxH2:5,
      requireCrossCheck:sourceCount>=2,
      allowContextSection:true,
      instruction:'Build a full evidence-led article. The writer chooses the actual H2 structure from the evidence. Prefer 3–5 distinct sections, but never add a section just to reach the preferred range. Every factual section must remain within the supplied evidence.'
    };
  }

  if (band==='usable' && coverage.readyForRichArticle===true) {
    return {
      mode:'bounded',
      targetWords:{min:450,max:750,soft:600},
      h2Guidance:{preferredMin:2,preferredMax:4,writerDecides:true,noPadding:true},
      maxH2:4,
      requireCrossCheck:sourceCount>=2,
      allowContextSection:false,
      instruction:'Write a bounded evidence-led article. The writer chooses the actual H2 structure from the strongest supported evidence. Prefer 2–4 distinct sections, but never add a section merely to increase length or satisfy a count.'
    };
  }

  if (band==='thin') {
    return {
      mode:'narrow',
      targetWords:{min:300,max:500,soft:400},
      h2Guidance:{preferredMin:1,preferredMax:2,writerDecides:true,noPadding:true},
      maxH2:2,
      requireCrossCheck:false,
      allowContextSection:false,
      instruction:'Keep the article narrow and factual. The writer chooses the actual H2 structure. Prefer 1–2 sections when supported, but use fewer if the evidence does not justify more. Never pad with unsupported sections.'
    };
  }

  return {
    mode:'blocked',
    targetWords:{min:0,max:0,soft:0},
    h2Guidance:{preferredMin:0,preferredMax:0,writerDecides:false,noPadding:true},
    maxH2:0,
    requireCrossCheck:false,
    allowContextSection:false,
    instruction:'Do not generate a publishable article. Evidence is insufficient; obtain more evidence first.'
  };
}
