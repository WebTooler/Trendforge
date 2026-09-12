import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { default: 'TrendForge — What Matters, Explained', template: '%s | TrendForge' },
  description: 'Smart, useful stories about AI, technology, digital life and how-to guides.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
