const trim = (value: string | undefined) => value?.trim() ?? '';

export function getAdsenseClientId() {
  const value = trim(process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID);
  return /^ca-pub-\d{16}$/.test(value) ? value : '';
}

export function getAdsensePublisherId() {
  const value = trim(process.env.ADSENSE_PUBLISHER_ID);
  return /^pub-\d{16}$/.test(value) ? value : '';
}

export function monetizationDisclosure() {
  return 'TrendForge may use advertising, sponsorships, or affiliate links to support the site. Any commercial relationship does not change our editorial standards.';
}
