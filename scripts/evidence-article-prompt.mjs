export function buildEvidenceArticlePrompt(basePrompt, blueprint) {
  if (!blueprint || blueprint.mode === 'blocked') {
    return `${basePrompt}

EVIDENCE ARTICLE POLICY:
- Do not generate a publishable article. Evidence is insufficient; obtain more evidence first.`;
  }

  const h2 = blueprint.h2Guidance || {};
  const words = blueprint.targetWords || {};
  const crossCheck = blueprint.requireCrossCheck
    ? '- Cross-check material developments across the supplied independent sources before presenting them as established facts.'
    : '- Use only the supplied evidence and preserve attribution or uncertainty where applicable.';

  return `${basePrompt}

EVIDENCE ARTICLE POLICY:
- Evidence mode: ${blueprint.mode}.
- Word guidance: ${words.min}-${words.max} words, with a soft target around ${words.soft}; never pad to reach the target.
- H2 guidance: prefer ${h2.preferredMin}-${h2.preferredMax} distinct H2 sections when the evidence supports them.
- The writer decides the actual H2 count and section titles.
- H2 minimum is not a hard requirement: use fewer sections when the evidence does not justify more.
- Maximum H2 count: ${blueprint.maxH2}.
- Never create an H2 merely to satisfy a count or increase article length.
- Every H2 must introduce a distinct, useful section grounded in the supplied evidence.
${crossCheck}
- ${blueprint.allowContextSection ? 'Context explicitly supported by the evidence may be included.' : 'Do not add a separate context section unless the supplied evidence clearly supports it.'}
- ${blueprint.instruction}`;
}
