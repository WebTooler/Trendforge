import Script from 'next/script';
import { getAdsenseClientId } from '@/lib/monetization';

export default function MonetizationHead() {
  const clientId = getAdsenseClientId();
  if (!clientId) return null;

  return (
    <Script
      id="adsense-script"
      strategy="afterInteractive"
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientId}`}
      crossOrigin="anonymous"
    />
  );
}
