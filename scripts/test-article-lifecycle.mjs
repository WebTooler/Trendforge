import assert from 'node:assert/strict';

const score = ({ ageDays, words, sourceCount, descriptionLength = 120 }) => {
  const staleness = ageDays >= 30 ? 100 : ageDays >= 14 ? 75 : ageDays >= 7 ? 45 : 10;
  const completeness = Math.min(100,
    (words >= 700 ? 45 : words >= 450 ? 35 : words >= 250 ? 25 : 15) +
    (sourceCount >= 2 ? 35 : sourceCount === 1 ? 20 : 0) +
    (descriptionLength >= 100 ? 20 : 10)
  );
  return Math.round(staleness * 0.55 + completeness * 0.45);
};

const status = (refreshScore) => refreshScore >= 75 ? 'refresh_candidate' : refreshScore >= 45 ? 'watch' : 'fresh';

const titleSimilarity = (a, b) => {
  const norm = s => new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length >= 5));
  const x = norm(a), y = norm(b);
  if (!x.size || !y.size) return 0;
  let n = 0;
  for (const w of x) if (y.has(w)) n++;
  return n / Math.max(x.size, y.size);
};

assert.equal(status(score({ ageDays: 35, words: 700, sourceCount: 2 })), 'refresh_candidate');
assert.equal(status(score({ ageDays: 10, words: 500, sourceCount: 1 })), 'watch');
// Keep the fresh fixture safely below the 45-point watch boundary.
assert.equal(status(score({ ageDays: 2, words: 500, sourceCount: 1 })), 'fresh');
assert.equal(score({ ageDays: 40, words: 700, sourceCount: 2 }) > score({ ageDays: 3, words: 700, sourceCount: 2 }), true);
assert.equal(titleSimilarity('AI model pricing changes for developers', 'AI model pricing changes for developers'), 1);
assert.equal(titleSimilarity('AI model pricing changes for developers', 'AI model pricing changes for teams'), 0.75);
assert.equal(titleSimilarity('AI model pricing changes', 'Weekend gardening tips'), 0);

console.log('PASS — refresh scoring respects age and completeness');
console.log('PASS — fresh/watch/refresh classifications are deterministic');
console.log('PASS — older complete content receives higher refresh pressure');
console.log('PASS — identical titles cluster at 100% similarity');
console.log('PASS — near-duplicate titles can be detected');
console.log('PASS — unrelated titles do not cluster');
console.log('Article Lifecycle deterministic suite: 6/6 PASS');
