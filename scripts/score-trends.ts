import fs from 'node:fs';
import { scoreTrend, type TrendCandidate } from '../lib/trend-scoring';

const input = 'data/trend-candidates.json';
const output = 'data/scored-trends.json';

if (!fs.existsSync(input)) {
  console.log(`No ${input} found; nothing to score.`);
  process.exit(0);
}

const candidates = JSON.parse(fs.readFileSync(input, 'utf8')) as TrendCandidate[];
const scored = candidates
  .map((candidate) => scoreTrend(candidate))
  .sort((a, b) => b.score - a.score);

fs.mkdirSync('data', { recursive: true });
fs.writeFileSync(output, JSON.stringify({ generatedAt: new Date().toISOString(), trends: scored }, null, 2));
console.log(`Scored ${scored.length} trend candidates.`);
