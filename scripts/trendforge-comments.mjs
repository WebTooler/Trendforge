export const commentsPolicy = Object.freeze({
  version: 1,
  mode: 'external-community-layer',
  provider: 'utterances',
  repository: 'WebTooler/Trendforge',
  mapping: 'pathname',
  label: 'comments',
  influencesResearch: false,
  influencesEvidence: false,
  influencesDecisions: false,
  influencesWriter: false,
  influencesEditorial: false,
  influencesClaimVerification: false,
  influencesQuality: false,
  influencesSafety: false,
  influencesLifecycle: false,
  influencesSearch: false,
  influencesSeo: false,
  influencesDistribution: false,
  influencesMonetization: false,
  changesPublicationGates: false,
  changesThresholds: false,
  autoRewrite: false,
  autoDelete: false,
});

export function getCommentsPolicy() {
  return { ...commentsPolicy };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(`TrendForge Comments v${commentsPolicy.version}: ${commentsPolicy.provider} / ${commentsPolicy.repository}`);
  console.log('Comments are an isolated community layer.');
}
