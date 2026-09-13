export type TrendForgeEvent = {
  name: string;
  timestamp: string;
  params: Record<string, string | number | boolean>;
};

const STORAGE_KEY = 'trendforge_analytics_events';
const MAX_EVENTS = 200;

export function trackEvent(name: string, params: Record<string, string | number | boolean> = {}) {
  if (typeof window === 'undefined') return;

  const event: TrendForgeEvent = { name, timestamp: new Date().toISOString(), params };
  try {
    const current = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as TrendForgeEvent[];
    current.push(event);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current.slice(-MAX_EVENTS)));
  } catch {
    // Analytics must never interrupt the user experience.
  }
}

export function getStoredAnalytics(): TrendForgeEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as TrendForgeEvent[];
  } catch {
    return [];
  }
}
