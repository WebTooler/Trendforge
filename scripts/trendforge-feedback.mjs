import fs from 'node:fs';

const outputPath = 'data/trendforge-feedback.json';
const articlesDir = 'content/articles';

const now = new Date().toISOString();
const files = fs.existsSync(articlesDir) ? fs.readdirSync(articlesDir).filter(f => f.endsWith('.md')) : [];

const records = files.map(file => ({
  article: file.replace(/\.md$/, ''),
  feedbackCount: 0,
  positive: 0,
  negative: 0,
  neutral: 0,
  themes: [],
  lastFeedbackAt: null
}));

const result = {
  version: 1,
  generatedAt: now,
  mode: 'observational',
  policy: {
    observationalOnly: true,
    readOnly: true,
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
    autoDelete: false
  },
  summary: {
    articlesTracked: records.length,
    feedbackCount: 0,
    positive: 0,
    negative: 0,
    neutral: 0
  },
  articles: records,
  signals: [],
  note: 'Feedback is an independent observation layer. It cannot modify any TrendForge structure, gate, threshold, article, or decision.'
};

fs.mkdirSync('data', { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n');
console.log(`TrendForge Feedback v1: ${records.length} article(s) tracked, 0 feedback event(s).`);
console.log('Feedback is observational-only and cannot modify any TrendForge structure or gate.');
