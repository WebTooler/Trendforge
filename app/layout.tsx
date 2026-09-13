import './globals.css';
import { siteMetadata, websiteJsonLd, safeJsonLd } from '@/lib/seo';
import MonetizationHead from '@/app/components/MonetizationHead';

export const metadata = siteMetadata();

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const jsonLd = safeJsonLd(websiteJsonLd());
  return <html lang="en"><body><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} /><MonetizationHead />{children}</body></html>;
}
