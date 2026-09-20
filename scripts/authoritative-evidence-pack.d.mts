export function buildAuthoritativeEvidencePack(args?: {
  candidate?: Record<string, unknown>;
  sources?: Array<Record<string, unknown>>;
  coverage?: Record<string, unknown>;
  blueprint?: Record<string, unknown>;
  generatedAt?: string;
}): Record<string, unknown>;

export function validateAuthoritativeEvidencePack(
  pack: unknown
): boolean;
