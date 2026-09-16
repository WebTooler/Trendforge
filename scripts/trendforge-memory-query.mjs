import fs from 'node:fs';

const MEMORY_PATH = 'data/trendforge-memory.json';

function loadMemory() {
  if (!fs.existsSync(MEMORY_PATH)) throw new Error(`Memory file not found: ${MEMORY_PATH}`);
  const memory = JSON.parse(fs.readFileSync(MEMORY_PATH, 'utf8'));
  if (!memory || typeof memory !== 'object') throw new Error('Invalid TrendForge memory object');
  return memory;
}

function clamp(value, min = 0, max = 100) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : null;
}

function normalize(value) {
  return String(value ?? '').trim().toLowerCase();
}

function latestRun(memory) {
  return Array.isArray(memory.runs) && memory.runs.length ? memory.runs[memory.runs.length - 1] : null;
}

function summary(memory) {
  const runs = Array.isArray(memory.runs) ? memory.runs : [];
  const topics = Array.isArray(memory.topics) ? memory.topics : [];
  const articles = Array.isArray(memory.articles) ? memory.articles : [];
  const latest = latestRun(memory);
  const categories = memory.categories && typeof memory.categories === 'object' ? memory.categories : {};

  return {
    updatedAt: memory.updatedAt ?? null,
    retained: {
      runs: runs.length,
      topics: topics.length,
      articles: articles.length,
    },
    categories,
    latestRun: latest,
    evidence: latest?.evidence ?? null,
    decisions: latest?.decisions ?? null,
    claims: latest?.claims ?? null,
    providers: latest?.providers ?? {},
    policy: memory.policy ?? {},
  };
}

function topicSearch(memory, query) {
  const needle = normalize(query);
  if (!needle) throw new Error('topic query requires a non-empty value');
  const topics = Array.isArray(memory.topics) ? memory.topics : [];
  return topics
    .filter((topic) => [topic.title, topic.key, topic.category].some((value) => normalize(value).includes(needle)))
    .slice(-20)
    .map((topic) => ({
      key: topic.key ?? null,
      title: topic.title ?? '',
      category: topic.category ?? '',
      decision: topic.decision ?? null,
      score: clamp(topic.score),
      confidence: clamp(topic.confidence),
      evidenceLevel: topic.evidenceLevel ?? 'none',
      lastSeenAt: topic.lastSeenAt ?? null,
    }));
}

function category(memory, value) {
  const wanted = normalize(value);
  if (!wanted) throw new Error('category requires a non-empty value');
  const topics = Array.isArray(memory.topics) ? memory.topics : [];
  const matches = topics.filter((topic) => normalize(topic.category) === wanted);
  return {
    category: value,
    topicCount: matches.length,
    decisions: matches.reduce((acc, topic) => {
      const key = topic.decision ?? 'unknown';
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
    averageScore: matches.length
      ? Math.round(matches.reduce((sum, topic) => sum + Number(topic.score ?? 0), 0) / matches.length)
      : null,
    averageConfidence: matches.length
      ? Math.round(matches.reduce((sum, topic) => sum + Number(topic.confidence ?? 0), 0) / matches.length)
      : null,
    evidenceLevels: matches.reduce((acc, topic) => {
      const key = topic.evidenceLevel ?? 'none';
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  };
}

function provider(memory, value) {
  const wanted = normalize(value);
  if (!wanted) throw new Error('provider requires a non-empty value');
  const runs = Array.isArray(memory.runs) ? memory.runs : [];
  const history = runs.map((run) => run?.providers?.[value] ?? run?.providers?.[Object.keys(run?.providers ?? {}).find((name) => normalize(name) === wanted)])
    .filter(Boolean);
  const totals = history.reduce((acc, item) => {
    acc.successes += Number(item.successes ?? 0);
    acc.failures += Number(item.failures ?? 0);
    if (item.inCooldown) acc.cooldownRuns += 1;
    return acc;
  }, { successes: 0, failures: 0, cooldownRuns: 0 });
  return { provider: value, samples: history.length, ...totals, latest: history.length ? history[history.length - 1] : null };
}

function recentRuns(memory, count = 5) {
  const limit = Math.max(1, Math.min(20, Number(count) || 5));
  return (Array.isArray(memory.runs) ? memory.runs : []).slice(-limit);
}

function usage() {
  return 'Usage: node scripts/trendforge-memory-query.mjs <summary|topic|category|provider|runs> [value]';
}

const [, , command = 'summary', value] = process.argv;
const memory = loadMemory();
let result;

switch (command) {
  case 'summary': result = summary(memory); break;
  case 'topic': result = topicSearch(memory, value); break;
  case 'category': result = category(memory, value); break;
  case 'provider': result = provider(memory, value); break;
  case 'runs': result = recentRuns(memory, value); break;
  case 'help': result = { usage: usage() }; break;
  default: throw new Error(`Unknown command '${command}'. ${usage()}`);
}

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
