import './globals.css';
import type { Metadata } from 'next';
import { defaultDescription, siteName, siteUrl } from '@/lib/seo';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'TrendForge — What Matters, Explained', template: '%s | TrendForge' },
  description: defaultDescription,
  alternates: { canonical: '/', types: { 'application/rss+xml': `${siteUrl}/feed.xml` } },
  openGraph: {
    type: 'website',
    siteName,
    title: 'TrendForge — What Matters, Explained',
    description: defaultDescription,
    url: siteUrl,
  },
  twitter: {
    card: 'summary',
    title: 'TrendForge — What Matters, Explained',
    description: defaultDescription,
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
