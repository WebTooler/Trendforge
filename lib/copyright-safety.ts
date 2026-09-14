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
  'Original',
  'AI-generated original',
]);

export function isImageLicenseAllowed(image: ImageCandidate): boolean {
  const isLocalOriginal = image.url.startsWith('/Trendforge/images/articles/') && image.source === 'TrendForge original editorial visual' && image.license === 'Original';
  const isAiOriginal = image.url.startsWith('/Trendforge/images/articles/') && image.source === 'TrendForge AI image generator' && image.license === 'AI-generated original';
  const isRemoteLicensed = image.url.startsWith('https://') && SAFE_LICENSES.has(image.license);
  return isLocalOriginal || isAiOriginal || isRemoteLicensed;
}

export function filterSafeImages(images: ImageCandidate[]): ImageCandidate[] {
  return images.filter(isImageLicenseAllowed);
}

function normalizeText(value: string): string {
  return value.replace(/<[^>]+>/g, ' ').replace(/&[a-z0-9#]+;/gi, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

function tokens(value: string): string[] {
  return normalizeText(value).split(/[^a-z0-9]+/).filter(word => word.length >= 4);
}

function sentenceSimilarity(a: string, b: string): number {
  const left = new Set(tokens(a));
  const right = new Set(tokens(b));
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  for (const word of left) if (right.has(word)) overlap++;
  return overlap / Math.max(1, left.size + right.size - overlap);
}

function splitSentences(value: string): string[] {
  return normalizeText(value).split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length >= 45);
}

function longestCommonPhrase(left: string, right: string, phraseLength = 12): number {
  const a = tokens(left);
  const b = tokens(right);
  if (a.length < phraseLength || b.length < phraseLength) return 0;
  const phrases = new Set<string>();
  for (let i = 0; i <= a.length - phraseLength; i++) phrases.add(a.slice(i, i + phraseLength).join(' '));
  for (let i = 0; i <= b.length - phraseLength; i++) if (phrases.has(b.slice(i, i + phraseLength).join(' '))) return phraseLength;
  return 0;
}

export function copyrightSafetyGate(article: { content: string; sources: string[]; images: ImageCandidate[]; sourceTexts?: string[] }, options: { requireImages?: boolean } = {}) {
  const normalized = normalizeText(article.content);
  const suspiciousPhrases = ['copy and paste', 'according to the article above', 'reproduced from', 'verbatim from', 'copied from', 'this article says'];
  const sentenceCount = splitSentences(normalized).length;
  const hasUsefulLength = normalized.length >= 900 && sentenceCount >= 6;
  const noSuspiciousTemplate = !suspiciousPhrases.some(phrase => normalized.includes(phrase));
  const validSources = article.sources.length >= 2 && article.sources.every(url => /^https:\/\//.test(url));
  const safeImages = article.images.every(isImageLicenseAllowed) && (!options.requireImages || article.images.length > 0);
  const sourceTexts = (article.sourceTexts ?? []).map(normalizeText).filter(Boolean);
  const articleSentences = splitSentences(normalized);
  const sourceSentences = sourceTexts.flatMap(splitSentences);
  let maxSourceSimilarity = 0;
  let maxCommonPhrase = 0;
  for (const articleSentence of articleSentences) {
    for (const sourceSentence of sourceSentences) {
      maxSourceSimilarity = Math.max(maxSourceSimilarity, sentenceSimilarity(articleSentence, sourceSentence));
      maxCommonPhrase = Math.max(maxCommonPhrase, longestCommonPhrase(articleSentence, sourceSentence));
    }
  }
  const noHighSimilaritySource = maxSourceSimilarity < 0.72 && maxCommonPhrase < 12;
  return {
    passed: hasUsefulLength && noSuspiciousTemplate && validSources && safeImages && noHighSimilaritySource,
    checks: { hasUsefulLength, noSuspiciousTemplate, validSources, safeImages, noHighSimilaritySource },
    metrics: { normalizedLength: normalized.length, sentenceCount, maxSourceSimilarity, maxCommonPhrase },
  };
}
