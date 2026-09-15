import fs from 'node:fs';
import { scoreTrend, type TrendCandidate } from '../lib/trend-scoring';

const input = 'data/trend-candidates.json';
const output = 'data/scored-trends.json';

if (!fs.existsSync(input)) {
  console.log(`No ${input} found; nothing to score.`);
  process.exit(0);
}

type Candidate = TrendCandidate & { source?: string; sourceName?: string; sourceUrl?: string; researchSignals?: { networkCount?: number; signalTypeCount?: number; corroboratingCandidates?: number; networks?: string[]; signalTypes?: string[] } };
const payload = JSON.parse(fs.readFileSync(input, 'utf8')) as { candidates?: Candidate[] };
const candidates = payload.candidates ?? [];

const STOP_WORDS = new Set(['about','after','again','also','been','being','could','from','have','into','more','most','over','said','some','than','that','their','there','these','they','this','what','when','which','with','will','would','your','ai','artificial','intelligence','technology','tech','software','digital','latest','news','update','updates','guide','how','today']);
function topicWords(title: string) { return new Set(title.toLowerCase().split(/[^a-z0-9]+/).filter(word => word.length >= 4 && !STOP_WORDS.has(word))); }

function sharedTopicSources(candidate: Candidate) {
  const words = topicWords(candidate.title);
  const publishers = new Set<string>();
  for (const other of candidates) {
    if (other === candidate) continue;
    const overlap = [...words].filter(word => topicWords(other.title).has(word)).length;
    const publisher = (other.sourceName || other.source || '').toLowerCase().trim();
    if (overlap >= 2 && publisher) publishers.add(publisher);
  }
  const ownPublisher = (candidate.sourceName || candidate.source || '').toLowerCase().trim();
  if (ownPublisher) publishers.add(ownPublisher);
  return publishers.size;
}

const scored = candidates.map((candidate) => {
  const researchSignals = candidate.researchSignals ?? { networkCount: 1, signalTypeCount: 1, corroboratingCandidates: 0 };
  const base = scoreTrend(candidate, sharedTopicSources(candidate));
  const networkBonus = Math.min(12, Math.max(0, (researchSignals.networkCount ?? 1) - 1) * 4);
  const signalTypeBonus = Math.min(8, Math.max(0, (researchSignals.signalTypeCount ?? 1) - 1) * 4);
  const corroborationBonus = Math.min(5, (researchSignals.corroboratingCandidates ?? 0) * 2);
  const signalScore = networkBonus + signalTypeBonus + corroborationBonus;
  const reasons = [...base.reasons];
  if (networkBonus > 0) reasons.push(`Cross-network discovery (${researchSignals.networkCount} networks)`);
  if (signalTypeBonus > 0) reasons.push(`Multiple signal types (${researchSignals.signalTypeCount})`);
  if (corroborationBonus > 0) reasons.push(`Topic corroborated by ${researchSignals.corroboratingCandidates} discovery result(s)`);
  return { ...base, score: Math.min(100, base.score + signalScore), researchSignalScore: signalScore, researchSignals, discoveryOnly: Boolean(candidate.discoveryOnly) };
}).sort((a, b) => b.score - a.score);

fs.mkdirSync('data', { recursive: true });
fs.writeFileSync(output, JSON.stringify({ generatedAt: new Date().toISOString(), scoringPolicy: { version: 2, discoverySignalsInfluenceScore: true, discoverySignalsAreNotEvidence: true }, trends: scored }, null, 2));
console.log(`Scored ${scored.length} trend candidates with cross-network research signals.`);
