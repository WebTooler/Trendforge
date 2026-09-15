export type TrendForgeWriterArgs = {
  prompt: string;
  category?: string;
  expectedTitle?: string;
};

export type TrendForgeWriterResult = {
  text: string;
  provider: string;
  policyVersion?: string;
  topicAlignment?: unknown;
};

export function generateWithTrendForgeWriter(args: TrendForgeWriterArgs): Promise<TrendForgeWriterResult>;
