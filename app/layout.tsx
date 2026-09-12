import './globals.css';
import type { Metadata } from 'next';

const siteUrl = 'https://webtooler.github.io/Trendforge';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'TrendForge — What Matters, Explained', template: '%s | TrendForge' },
  description: 'Smart, useful stories about AI, technology, digital life and how-to guides.',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'TrendForge',
    title: 'TrendForge — What Matters, Explained',
    description: 'Smart, useful stories about AI, technology, digital life and how-to guides.',
    url: siteUrl,
  },
  twitter: {
    card: 'summary',
    title: 'TrendForge — What Matters, Explained',
    description: 'Smart, useful stories about AI, technology, digital life and how-to guides.',
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
