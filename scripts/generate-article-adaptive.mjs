import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const scoredPath = 'data/scored-trends.json';
const articlesDir = 'content/articles';

if (!fs.existsSync(scoredPath)) {
  console.log(`No ${scoredPath}; nothing to publish.`);
  process.exit(0);
}

const original = JSON.parse(fs.readFileSync(scoredPath, 'utf8'));
const trends = original.trends ?? [];
const preferredFallbackCategories = new Set(['How-To', 'Technology', 'Innovation', 'Product Launches', 'Digital Life', 'AI', 'Crypto']);

const before = new Set(
  fs.existsSync(articlesDir)
    ? fs.readdirSync(articlesDir).filter((name) => name.endsWith('.md'))
    : [],
);

const ranked = [...trends]
  .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
  .filter((candidate, index, all) => all.findIndex((item) => item.link === candidate.link) === index);

const primary = ranked.filter((item) => item.eligible);
const fallback = ranked.filter((item) => !item.eligible && preferredFallbackCategories.has(item.category));
const queue = [...primary, ...fallback].slice(0, 12);

console.log(`Adaptive publishing queue: ${queue.length} candidate(s).`);

let published = false;
let attempted = 0;

for (const candidate of queue) {
  attempted += 1;
  const attemptTrends = trends.map((item) => ({ ...item, eligible: item.link === candidate.link }));
  fs.writeFileSync(scoredPath, JSON.stringify({ ...original, trends: attemptTrends }, null, 2));
  console.log(`Attempt ${attempted}/${queue.length}: ${candidate.category} — ${candidate.title}`);

  const result = spawnSync('npx', ['tsx', 'scripts/generate-article.ts'], {
    stdio: 'inherit',
    env: process.env,
  });

  const after = new Set(
    fs.existsSync(articlesDir)
      ? fs.readdirSync(articlesDir).filter((name) => name.endsWith('.md'))
      : [],
  );
  const newArticle = [...after].find((name) => !before.has(name));

  if (newArticle) {
    console.log(`Adaptive queue published: ${newArticle}`);
    published = true;
    break;
  }

  if (result.error) console.log(`Candidate attempt failed to execute: ${result.error.message}`);
  console.log('Candidate did not produce a publishable article; moving to the next candidate.');
}

// Never leave the scored-trends file with the temporary single-candidate eligibility state.
fs.writeFileSync(scoredPath, JSON.stringify(original, null, 2));

if (!published) {
  console.log('Adaptive queue exhausted without a publishable article. Pipeline continues without publishing low-quality content.');
}
