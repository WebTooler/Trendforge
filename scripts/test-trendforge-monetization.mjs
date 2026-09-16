import { classifyArticle, policy } from './trendforge-monetization.mjs';

const fixtures = [
  { title: 'Best AI tools for small teams', description: 'Compare useful software and pricing.', category: 'AI', content: [], sources: [] },
  { title: 'What is edge computing?', description: 'A simple explainer.', category: 'Technology', content: [], sources: [] },
  { title: 'AI industry update', description: 'What changed this week.', category: 'AI', content: [], sources: [{ url: 'https://example.com', title: 'Source' }] },
];
const results = fixtures.map(classifyArticle);
if (results[0].signals.commercialIntent !== 'high' || results[0].signals.affiliateFit !== 'high') throw new Error('Commercial/affiliate classification failed');
if (results[1].signals.evergreenPotential !== 'high' || results[1].signals.displayAdFit !== 'high') throw new Error('Evergreen classification failed');
if (!results[2].advisoryOnly || results[2].signals.newsletterFit !== 'medium') throw new Error('Advisory classification failed');
for (const [key, value] of Object.entries(policy)) {
  if (key.startsWith('changes') && value !== false) throw new Error(`${key} must remain false`);
  if (key.startsWith('auto') && value !== false) throw new Error(`${key} must remain false`);
}
console.log('Phase 20 Monetization Intelligence deterministic suite: 3/3 PASS');
console.log('Monetization Intelligence is advisory-only and isolated from the TrendForge publishing pipeline.');
