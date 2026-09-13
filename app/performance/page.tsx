import type { Metadata } from 'next';
import PerformanceDashboard from '@/app/components/PerformanceDashboard';

export const metadata: Metadata = {
  title: 'Search Performance Dashboard',
  description: 'Private, browser-only analysis of Google Search Console CSV exports for TrendForge.',
  robots: { index: false, follow: false },
};

export default function PerformancePage() {
  return <main className="performance-page">
    <header className="performance-header">
      <a className="legal-back" href="/Trendforge/">← TrendForge</a>
      <div className="eyebrow">Owner tool · browser only</div>
      <h1>Search performance <span>dashboard.</span></h1>
      <p>Upload a Google Search Console CSV export to see clicks, impressions, CTR, position and ranking opportunities. Your file is processed in this browser and is never uploaded by this dashboard.</p>
    </header>
    <PerformanceDashboard />
  </main>;
}
