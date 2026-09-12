export type ImageCandidate = {
  url: string;
  source: string;
  license: string;
  attribution?: string;
};

const SAFE_LICENSES = new Set([
  'CC0',
  'Public Domain',
  'Pexels License',
  'Unsplash License',
  'Pixabay Content License',
]);

export function isImageLicenseAllowed(image: ImageCandidate): boolean {
  return image.url.startsWith('https://') && SAFE_LICENSES.has(image.license);
}

export function filterSafeImages(images: ImageCandidate[]): ImageCandidate[] {
  return images.filter(isImageLicenseAllowed);
}

function normalizeText(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z0-9#]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function sentenceSimilarity(a: string, b: string): number {
  const left = new Set(normalizeText(a).split(/[^a-z0-9]+/).filter(w => w.length >= 4));
  const right = new Set(normalizeText(b).split(/[^a-z0-9]+/).filter(w => w.length >= 4));
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  for (const word of left) if (right.has(word)) overlap++;
  return overlap / Math.max(1, Math.min(left.size, right.size));
}

export function copyrightSafetyGate(article: { content: string; sources: string[]; images: ImageCandidate[]; sourceTexts?: string[] }) {
  const normalized = normalizeText(article.content);
  const suspiciousPhrases = [
    'copy and paste',
    'according to the article above',
    'reproduced from',
    'verbatim from',
    'copied from',
    'this article says',
  ];

  const sentenceCount = normalized.split(/[.!?]+/).map(s => s.trim()).filter(Boolean).length;
  const hasUsefulLength = normalized.length >= 900 && sentenceCount >= 6;
  const noSuspiciousTemplate = !suspiciousPhrases.some(phrase => normalized.includes(phrase));
  const validSources = article.sources.length >= 2 && article.sources.every(url => /^https:\/\//.test(url));
  const safeImages = article.images.every(isImageLicenseAllowed);
  const sourceTexts = (article.sourceTexts ?? []).map(normalizeText).filter(Boolean);
  const maxSourceSimilarity = sourceTexts.length
    ? Math.max(...sourceTexts.map(source => sentenceSimilarity(normalized, source)))
    : 0;
  const noHighSimilaritySource = maxSourceSimilarity < 0.72;

  return {
    passed: hasUsefulLength && noSuspiciousTemplate && validSources && safeImages && noHighSimilaritySource,
    checks: { hasUsefulLength, noSuspiciousTemplate, validSources, safeImages, noHighSimilaritySource },
    metrics: { normalizedLength: normalized.length, sentenceCount, maxSourceSimilarity },
  };
}
