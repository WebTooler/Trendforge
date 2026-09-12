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

export function copyrightSafetyGate(article: { content: string; sources: string[]; images: ImageCandidate[] }) {
  const normalized = article.content.toLowerCase();
  const suspiciousPhrases = [
    'copy and paste',
    'as reported by',
    'according to the article above',
    'reproduced from',
  ];

  const noSuspiciousTemplate = !suspiciousPhrases.some((phrase) => normalized.includes(phrase));
  const validSources = article.sources.length >= 2 && article.sources.every((url) => url.startsWith('https://'));
  const safeImages = article.images.every(isImageLicenseAllowed);

  return {
    passed: noSuspiciousTemplate && validSources && safeImages,
    checks: { noSuspiciousTemplate, validSources, safeImages },
  };
}
