export async function generateWithTrendForgeWriter({prompt,category='Technology',expectedTitle=''}){
  const inferred=category&&category!=='Technology'?category:prompt.match(/(?:category|section)\s*[:=]\s*(AI|Technology|How-To|Innovation|Product Launches|Digital Life|Crypto)/i)?.[1]||category;
  const contract=buildWriterContract(inferred);
  const blueprint=loadEvidenceBlueprint(expectedTitle);
  const wordGuide=blueprint?.targetWords||{min:WRITER_TARGET_MIN_WORDS,max:WRITER_TARGET_MAX_WORDS,soft:600};
  const h2Guide=blueprint?.h2Guidance||{preferredMin:3,preferredMax:5};
  const hardH2Max=Math.max(1,Number(h2Guide.preferredMax||3));
  const hardWordMin=Math.max(MIN_WRITER_WORDS,Number(wordGuide.min||WRITER_TARGET_MIN_WORDS));
  const hardWordMax=Math.min(1100,Math.max(hardWordMin,Number(wordGuide.max||WRITER_TARGET_MAX_WORDS)));
  const architectureGuide=blueprint ? [
    'ARTICLE ARCHITECTURE — derive the structure from evidence before drafting:',
    `- Evidence mode: ${blueprint?.mode||'standard'}.`,
    `- Evidence-supported word range: ${wordGuide.min}-${wordGuide.max} (soft ${wordGuide.soft}).`,
    `- H2 HARD CEILING: never exceed ${hardH2Max} H2 headings. If the story needs less structure, use fewer. This is a validation constraint, not a suggestion.`,
    '- Give each H2 one distinct job: development, evidence/details, implications/context, limitations/uncertainty, or supported next steps.',
    '- Do not repeat the same fact in multiple sections merely to increase length.',
    '- Do not create an H2 for a single trivial sentence or unsupported context.',
    '- Opening paragraph must establish the concrete development without repeating the headline.',
    '- Final section must add a distinct takeaway, limitation, uncertainty, or supported next step; never use a generic conclusion.',
    '- Prefer fewer strong sections over many thin sections.'
  ].join('\\n') : '';