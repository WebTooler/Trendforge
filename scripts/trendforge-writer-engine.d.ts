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


declare module './evidence-extraction.mjs' {
  export function extractEvidenceFromHtml(html?: string, storyTitle?: string): {
    body: string;
    passages: string[];
    kind: string;
    headline: string;
    description: string;
    rawParagraphCount: number;
    selectedPassageCount: number;
    selectedChars: number;
  };
}
