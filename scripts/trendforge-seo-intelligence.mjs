export const seoIntelligencePolicy = Object.freeze({
  version: 1,
  mode: 'deterministic-audit',
  titleMinLength: 30,
  titleMaxLength: 70,
  descriptionMinLength: 50,
  descriptionMaxLength: 170,
  changesPublicationGates: false,
  changesThresholds: false,
  changesResearch: false,
  changesEvidence: false,
  changesWriter: false,
  changesEditorial: false,
  changesClaimVerification: false,
  changesSafety: false,
});

export function normalizeSeoText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

export function auditSeoArticle(article) {
  const title = normalizeSeoText(article?.title);
  const description = normalizeSeoText(article?.description);
  const slug = normalizeSeoText(article?.slug);
  const issues = [];
  const checks = {
    titlePresent: title.length > 0,
    titleLength: title.length >= seoIntelligencePolicy.titleMinLength && title.length <= seoIntelligencePolicy.titleMaxLength,
    descriptionPresent: description.length > 0,
    descriptionLength: description.length >= seoIntelligencePolicy.descriptionMinLength && description.length <= seoIntelligencePolicy.descriptionMaxLength,
    slugPresent: slug.length > 0,
    canonicalReady: slug.length > 0,
  };
  if (!checks.titlePresent) issues.push('missing_title');
  else if (!checks.titleLength) issues.push('title_length');
  if (!checks.descriptionPresent) issues.push('missing_description');
  else if (!checks.descriptionLength) issues.push('description_length');
  if (!checks.slugPresent) issues.push('missing_slug');
  return { checks, issues, pass: issues.length === 0 };
}

export function auditSeoArticles(articles) {
  const results = articles.map((article) => ({ slug: article.slug, ...auditSeoArticle(article) }));
  const passed = results.filter((result) => result.pass).length;
  return { total: results.length, passed, failed: results.length - passed, results };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(`TrendForge SEO Intelligence v${seoIntelligencePolicy.version}: ${seoIntelligencePolicy.mode}`);
  console.log('SEO is an audit/metadata layer and does not change publishing decisions or thresholds.');
}
