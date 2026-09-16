export const TREND_FORGE_CATEGORIES = [
  'AI',
  'Technology',
  'How-To',
  'Innovation',
  'Product Launches',
  'Digital Life',
  'Crypto',
] as const;

export type TrendForgeCategory = (typeof TREND_FORGE_CATEGORIES)[number];

export function categorySlug(category: string) {
  return category.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
