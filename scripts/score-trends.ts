import fs from 'node:fs';
import { scoreTrend, type TrendCandidate } from '../lib/trend-scoring';

const input = 'data/trend-candidates.json';
const output = 'data/scored-trends.json';

if (!fs.existsSync(input)) {
  console.log(`No ${input} found; nothing to score.`);
  process.exit(0);
}

type Candidate = TrendCandidate & { source?: string; sourceName?: string; sourceUrl?: string };
const payload = JSON.parse(fs.readFileSync(input, 'utf8')) as { candidates?: Candidate[] };
const candidates = payload.candidates ?? [];

const STOP_WORDS = new Set([
  'about','after','again','also','been','being','could','from','have','into','more','most','over','said','some','than','that','their','there','these','they','this','what','when','which','with','will','would','your',
  'ai','artificial','intelligence','technology','tech','software','digital','latest','news','update','updates','guide','how','today'
]);

function topicWords(title: string) {
  return new Set(title.toLowerCase().split(/[^a-z0-9]+/).filter(word => word.length >= 4 && !STOP_WORDS.has(word)));
}

function sharedTopicSources(candidate: Candidate) {
  const words = topicWords(candidate.title);
  const publishers = new Set<string>();
  for (const other of candidates) {
    if (other === candidate) continue;
    const otherWords = topicWords(other.title);
    const overlap = [...words].filter(word => otherWords.has(word)).length;
    const publisher = (other.sourceName || other.source || '').toLowerCase().trim();
    if (overlap >= 2 && publisher) publishers.add(publisher);
  }
  const ownPublisher = (candidate.sourceName || candidate.source || '').toLowerCase().trim();
  if (ownPublisher) publishers.add(ownPublisher);
  return publishers.size;
}

const scored = candidates
  .map((candidate) => scoreTrend(candidate, sharedTopicSources(candidate)))
  .sort((a, b) => b.score - a.score);

fs.mkdirSync('data', { recursive: true });
fs.writeFileSync(output, JSON.stringify({ generatedAt: new Date().toISOString(), trends: scored }, null, 2));
console.log(`Scored ${scored.length} trend candidates.`);
