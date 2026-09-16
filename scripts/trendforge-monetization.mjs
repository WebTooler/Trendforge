import fs from 'node:fs';
import { articles } from '../lib/articles.ts';

export const policy = {
  version: 1,
  mode: 'advisory-only',
  changesPublicationGates: false,
  changesThresholds: false,
  changesResearch: false,
  changesEvidence: false,
  changesWriter: false,
  changesEditorial: false,
  changesClaimVerification: false,
  changesSafety: false,
  autoInjectAds: false,
  autoInjectAffiliateLinks: false,
  autoRewriteArticles: false,
};

const commercialTerms = /\b(best|compare|comparison|review|reviews|price|pricing|cost|buy|buying|tool|tools|software|service|services|product|products|guide|how to choose|alternatives|vs|versus)\b/i;
const subscriptionTerms = /\b(newsletter|subscribe|explainer|analysis|deep dive|guide|how to|learn|explained)\b/i;
const evergreenTerms = /\b(how to|guide|explained|what is|basics|tips|best|compare|alternatives)\b/i;

function textOf(article) {
  return [article.title, article.description, article.category, ...(article.content || [])].filter(Boolean).join(' ');
}

export function classifyArticle(article) {
  const text = textOf(article);
  const commercial = commercialTerms.test(text);
  const subscription = subscriptionTerms.test(text);
  const evergreen = evergreenTerms.test(text);
  const hasSources = Array.isArray(article.sources) && article.sources.length > 0;
  const category = String(article.category || '').toLowerCase();
  const productCategory = /ai|technology|digital|innovation|product/.test(category);
  const signals = {
    commercialIntent: commercial ? 'high' : productCategory ? 'medium' : 'low',
    affiliateFit: commercial && (productCategory || /product|tool|software|service/i.test(text)) ? 'high' : commercial ? 'medium' : 'low',
    displayAdFit: article.title ? (evergreen ? 'high' : 'medium') : 'low',
    newsletterFit: subscription ? 'high' : 'medium',
    premiumFit: /analysis|deep dive|comparison|explained/i.test(text) ? 'medium' : 'low',
    evergreenPotential: evergreen ? 'high' : 'medium',
  };
  const reasons = [];
  if (commercial) reasons.push('commercial-intent language detected');
  if (productCategory) reasons.push('product-oriented category signal');
  if (evergreen) reasons.push('evergreen/search-oriented format signal');
  if (subscription) reasons.push('reader-learning/subscription signal');
  if (hasSources) reasons.push('published source coverage exists');
  return { slug: article.slug, title: article.title, category: article.category, signals, reasons, advisoryOnly: true };
}

export function analyzeArticles(input = articles) {
  return input.map(classifyArticle);
}

if (process.argv[1]?.endsWith('trendforge-monetization.mjs')) {
  const output = { version: 1, generatedAt: new Date().toISOString(), policy, articles: analyzeArticles() };
  fs.mkdirSync('data', { recursive: true });
  fs.writeFileSync('data/trendforge-monetization.json', JSON.stringify(output, null, 2));
  console.log(`TrendForge Monetization Intelligence: analyzed ${output.articles.length} articles (advisory-only).`);
}
