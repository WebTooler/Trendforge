export function deriveEvidenceArticleBlueprint(coverage={}) {
  const score=Number(coverage.score||0);
  const band=coverage.band||'insufficient';
  const sourceCount=Number(coverage.sourceCount||0);
  const passages=Number(coverage.totalPassages||0);
  const chars=Number(coverage.totalChars||0);
  const facts=Number(coverage.factualSignals||0);

  if (band==='rich' && coverage.readyForRichArticle===true) {
    return {
      mode:'rich',
      targetWords:{min:700,max:1000,soft:850},
      minH2:3,maxH2:5,
      requireCrossCheck:sourceCount>=2,
      allowContextSection:true,
      instruction:'Build a full evidence-led article with distinct sections for what changed, supporting evidence, implications, and what to watch next. Every factual section must remain within the supplied evidence.'
    };
  }

  if (band==='usable' && coverage.readyForRichArticle===true) {
    return {
      mode:'bounded',
      targetWords:{min:450,max:750,soft:600},
      minH2:2,maxH2:4,
      requireCrossCheck:sourceCount>=2,
      allowContextSection:false,
      instruction:'Write a bounded evidence-led article. Cover only the strongest supported facts and implications; do not add sections merely to increase length.'
    };
  }

  if (band==='thin') {
    return {
      mode:'narrow',
      targetWords:{min:300,max:500,soft:400},
      minH2:1,maxH2:2,
      requireCrossCheck:false,
      allowContextSection:false,
      instruction:'Keep the article narrow and factual. Prefer a short useful brief over unsupported context or expansion.'
    };
  }

  return {
    mode:'blocked',
    targetWords:{min:0,max:0,soft:0},
    minH2:0,maxH2:0,
    requireCrossCheck:false,
    allowContextSection:false,
    instruction:'Do not generate a publishable article. Evidence is insufficient; obtain more evidence first.'
  };
}
