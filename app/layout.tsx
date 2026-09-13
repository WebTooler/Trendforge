import './globals.css';
import { siteMetadata, websiteJsonLd, safeJsonLd } from '@/lib/seo';
import MonetizationHead from '@/app/components/MonetizationHead';

export const metadata = siteMetadata();

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const jsonLd = safeJsonLd(websiteJsonLd());
  return (
    <html lang="en">
      <head>
        <meta name="referrer" content="strict-origin-when-cross-origin" />
        <meta httpEquiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' https://pagead2.googlesyndication.com https://www.googletagservices.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data: https:; connect-src 'self' https://buttondown.com https://pagead2.googlesyndication.com; frame-src 'self' https://googleads.g.doubleclick.net https://www.google.com; object-src 'none'; base-uri 'self'; form-action 'self' https://buttondown.com; upgrade-insecure-requests" />
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        <meta httpEquiv="Permissions-Policy" content="camera=(), microphone=(), geolocation=(), payment=(), usb=()" />
      </head>
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
        <MonetizationHead />
        {children}
      </body>
    </html>
  );
}
