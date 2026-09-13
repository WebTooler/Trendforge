# TrendForge Monetization

TrendForge keeps monetization optional and static-site friendly. No paid server is required.

## AdSense

The site supports Google AdSense Auto ads without hard-coding a publisher ID into the repository.

When an AdSense account is approved:

1. Add repository variable `NEXT_PUBLIC_ADSENSE_CLIENT_ID` with the `ca-pub-...` client ID.
2. Add repository variable `ADSENSE_PUBLISHER_ID` with the `pub-...` publisher ID.
3. Trigger a deployment.

The deployment workflow then:
- loads the AdSense script only when a valid client ID is configured;
- generates `public/ads.txt` only when a valid publisher ID is configured;
- removes `ads.txt` when no publisher ID is configured, avoiding a fake/placeholder ads.txt file.

Google's current ads.txt format for a directly controlled AdSense account is:

`google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0`

Do not put an API key in `NEXT_PUBLIC_*` variables.

## Affiliate links

Affiliate links can be added later with clear disclosure and normal `rel="sponsored"` handling. TrendForge does not currently require any affiliate network or paid API.

## Sponsorships

Sponsored relationships should be clearly disclosed and kept separate from editorial decisions.

## Disclosure page

Public disclosure: `/monetization/`
