import fs from 'node:fs';
import { articles } from '../lib/articles.ts';

const OUTPUT = 'data/trendforge-distribution.json';

const CHANNELS = ['website', 'rss', 'newsletter', 'social', 'community'];
const SOCIAL_CATEGORIES = new Set(['AI', 'Technology', 'Digital Life', 'Innovation', 'Product Launches', 'Crypto']);
const EVERGREEN_CATEGORIES = new Set(['How-To', 'Digital Life']);

function clean(text = '') {
  return String(text).replace(/\s+/g, ' ').trim();
}

function excerpt(article) {
  return clean(article.description || article.content?.[0] || '').slice(0, 220);
}

function packageFor(article) {
  const title = clean(article.title);
  const description = excerpt(article);
  const category = clean(article.category);
  const evergreen = EVERGREEN_CATEGORIES.has(category);
  const socialEligible = SOCIAL_CATEGORIES.has(category);

  const channels = ['website', 'rss'];
  if (socialEligible) channels.push('social');
  channels.push('newsletter');
  if (evergreen || description.length >= 80) channels.push('community');

  return {
    slug: article.slug,
    title,
    category,
    canonicalPath: `/Trendforge/article/${article.slug}`,
    channels,
    assets: {
      socialHeadline: title.slice(0, 120),
      socialSummary: description.slice(0, 200),
      newsletterSubject: title.slice(0, 90),
      newsletterTeaser: description.slice(0, 180),
      communitySummary: description.slice(0, 220),
    },
    timing: evergreen ? 'evergreen-recirculation' : 'publish-window',
    advisoryOnly: true,
  };
}

const packages = articles.map(packageFor);
const allChannelsValid = packages.every((item) => item.channels.every((channel) => CHANNELS.includes(channel)));
const noDuplicates = packages.every((item) => new Set(item.channels).size === item.channels.length);

const result = {
  version: 1,
  generatedAt: new Date().toISOString(),
  mode: 'advisory-only',
  channels: CHANNELS,
  policy: {
    changesPublicationGates: false,
    changesThresholds: false,
    changesResearch: false,
    changesEvidence: false,
    changesWriter: false,
    changesEditorial: false,
    changesClaimVerification: false,
    changesSafety: false,
    autoPost: false,
    autoSpam: false,
    duplicateProtection: true,
  },
  articleCount: packages.length,
  validChannels: allChannelsValid,
  duplicateChannelsAbsent: noDuplicates,
  packages,
};

fs.mkdirSync('data', { recursive: true });
fs.writeFileSync(OUTPUT, JSON.stringify(result, null, 2));
console.log(`TrendForge Distribution Intelligence: prepared ${packages.length} article packages (advisory-only).`);
