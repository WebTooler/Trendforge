import './globals.css';
import { siteMetadata, siteName, siteUrl, websiteJsonLd, safeJsonLd } from '@/lib/seo';

export const metadata = siteMetadata();

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const jsonLd = safeJsonLd(websiteJsonLd());
  return <html lang="en"><body><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />{children}</body></html>;
}
