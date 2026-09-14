declare module '*.mjs' {
  export interface TrendForgeWriterResult {
    text: string;
    provider: string;
    policyVersion: string;
  }

  export function generateWithTrendForgeWriter(options: {
    prompt: string;
    category?: string;
  }): Promise<TrendForgeWriterResult>;
}
