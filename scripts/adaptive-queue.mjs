import fs from 'node:fs';

const decisionPath = 'data/decision-queue.json';
const articlesDir = 'content/articles';
const outputPath = 'data/adaptive-queue.json';

if (!fs.existsSync(decisionPath)) {
  console.log('Adaptive Queue v1: no decision queue; nothing to rank.');
  process.exit(0);
}

const data = JSON.parse(fs.readFileSync(decisionPath, 'utf8'));
const decisions = Array.isArray(data.decisions) ? data.decisions : [];
const categories = ['AI', 'Technology', 'How-To', 'Innovation', 'Product Launches', 'Digital Life', 'Crypto'];
const published = [];

if (fs.existsSync(articlesDir)) {
  for (const file of fs.readdirSync(articlesDir).filter((name) => name.endsWith('.md'))) {
    const raw = fs.readFileSync(`${articlesDir}/${file}`, 'utf8');
    const category = raw.match(/^category:\s*["']?(.+?)["']?\s*$/mi)?.[1]?.trim() || 'Technology';
    const publishedAt = raw.match(/^publishedAt:\s*["']?(.+?)["']?\s*$/mi)?.[1]?.trim() || '';
    published.push({ category, publishedAt: new Date(publishedAt).getTime() || 0 });
  }
}
published.sort((a, b) => b.publishedAt - a.publishedAt);

const counts = Object.fromEntries(categories.map((category) => [category, 0]));
for (const item of published) if (counts[item.category] !== undefined) counts[item.category] += 1;
const recentCategories = published.slice(0, 3).map((item) => item.category);
const total = Math.max(1, categories.reduce((sum, category) => sum + counts[category], 0));

const ranked = decisions
  .filter((item) => item.decision === 'publish_candidate' || item.decision === 'review')
  .map((item) => {
    const count = counts[item.category] ?? 0;
    const gap = count === 0 ? 18 : Math.max(0, 12 - count * 2);
    const recentPenalty = recentCategories[0] === item.category ? 12 : recentCategories.includes(item.category) ? 5 : 0;
    const share = count / total;
    const balance = share > 0.35 ? -8 : share < 0.10 ? 8 : 0;
    const priority = Math.round((item.decisionScore ?? 0) + gap + balance - recentPenalty);
    return { ...item, categoryGap: gap, recentCategoryPenalty: recentPenalty, balanceAdjustment: balance, adaptivePriority: priority };
  })
  .sort((a, b) => b.adaptivePriority - a.adaptivePriority || (b.decisionScore ?? 0) - (a.decisionScore ?? 0));

const selected = [];
const categorySlots = new Map();
for (const item of ranked) {
  const used = categorySlots.get(item.category) || 0;
  if (used >= 3) continue;
  selected.push(item);
  categorySlots.set(item.category, used + 1);
  if (selected.length >= 12) break;
}

const result = {
  version: 1,
  generatedAt: new Date().toISOString(),
  policy: { maxQueueSize: 12, maxCandidatesPerCategory: 3, balancesCategoryShare: true, penalizesRecentCategory: true },
  categoryCounts: counts,
  recentCategories,
  summary: { considered: ranked.length, selected: selected.length },
  queue: selected,
};

fs.mkdirSync('data', { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(`Adaptive Queue v1: ${selected.length} candidate(s) selected from ${ranked.length}.`);
console.log(`Category mix: ${[...categorySlots.entries()].map(([category, count]) => `${category}=${count}`).join(', ') || 'none'}`);
if (selected[0]) console.log(`Top adaptive candidate: ${selected[0].title} (${selected[0].adaptivePriority}/100 priority).`);
