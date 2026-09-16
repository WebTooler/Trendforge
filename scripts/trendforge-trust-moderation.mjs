export const trustModerationPolicy = Object.freeze({
  version: 1,
  mode: 'advisory-only',
  provider: 'utterances',
  identityProvider: 'github',
  enforcement: 'manual-github-moderation',
  statuses: ['allow', 'review', 'block'],
  signals: ['link_spam', 'repetition', 'contact_data', 'abuse', 'threat', 'impersonation', 'off_topic'],
  autoHide: false,
  autoDelete: false,
  autoLock: false,
  autoBan: false,
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
  autoRewriteArticle: false,
  autoDeleteArticle: false,
});

const CONTACT_PATTERN = /(?:\+?\d[\d\s().-]{7,}\d|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/;
const URL_PATTERN = /https?:\/\/\S+/gi;
const THREAT_PATTERN = /\b(?:kill|murder|hurt|attack)\b.{0,40}\b(?:you|him|her|them)\b/i;
const ABUSE_PATTERN = /\b(?:idiot|moron|stupid|shut up)\b/i;
const IMPERSONATION_PATTERN = /\b(?:official|admin|staff|support)\b.{0,30}\b(?:trendforge|github)\b/i;

export function normalizeComment(text) {
  return String(text ?? '').replace(/\s+/g, ' ').trim();
}

export function classifyComment(text) {
  const normalized = normalizeComment(text);
  if (!normalized) return { status: 'review', risk: 'medium', signals: ['empty'], reason: 'Empty comment requires review.' };

  const signals = [];
  const urls = normalized.match(URL_PATTERN) ?? [];
  if (urls.length >= 3) signals.push('link_spam');
  if (/(.)\1{8,}/.test(normalized)) signals.push('repetition');
  if (CONTACT_PATTERN.test(normalized)) signals.push('contact_data');
  if (THREAT_PATTERN.test(normalized)) signals.push('threat');
  if (ABUSE_PATTERN.test(normalized)) signals.push('abuse');
  if (IMPERSONATION_PATTERN.test(normalized)) signals.push('impersonation');

  if (signals.includes('threat')) return { status: 'block', risk: 'high', signals, reason: 'Threat-like language requires moderator action.' };
  if (signals.includes('impersonation') || signals.includes('link_spam')) return { status: 'block', risk: 'high', signals, reason: 'Potential impersonation or link spam requires moderator action.' };
  if (signals.includes('contact_data') || signals.includes('abuse') || signals.includes('repetition')) return { status: 'review', risk: 'medium', signals, reason: 'Potentially sensitive or disruptive content requires review.' };
  return { status: 'allow', risk: 'low', signals, reason: 'No deterministic moderation signal detected.' };
}

export function getTrustModerationPolicy() {
  return { ...trustModerationPolicy };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(`TrendForge Trust + Moderation v${trustModerationPolicy.version}: ${trustModerationPolicy.mode}`);
  console.log('Moderation is advisory-only; enforcement remains manual and isolated from publishing.');
}
