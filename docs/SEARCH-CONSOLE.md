# Google Search Console setup

TrendForge is prepared for Google Search Console. The site already exposes a crawlable sitemap at:

`https://webtooler.github.io/Trendforge/sitemap.xml`

and `robots.txt` references that sitemap.

## One-time setup

1. Open Google Search Console and add the URL-prefix property:
   `https://webtooler.github.io/Trendforge/`
2. Choose the **HTML tag** verification method.
3. Copy the verification value from the `content="..."` attribute.
4. Add it to the GitHub Actions repository variable named `GOOGLE_SITE_VERIFICATION`.
   - Repository: **Settings → Secrets and variables → Actions → Variables**
   - Name: `GOOGLE_SITE_VERIFICATION`
   - Value: the Google verification token only.
5. Push/redeploy the site. TrendForge will automatically emit Google's verification meta tag through the centralized SEO metadata layer.
6. Return to Search Console and click **Verify**.
7. After verification, open **Sitemaps** and submit `sitemap.xml`.
8. Use **URL Inspection** on the homepage and an article URL, then request indexing when appropriate.

## What is automated

- Canonical URLs are generated centrally.
- `robots.txt` allows crawling and points to the sitemap.
- `sitemap.xml` is generated from the article index.
- Article structured data and breadcrumbs are generated centrally.
- Google verification is optional and only emitted when `GOOGLE_SITE_VERIFICATION` is configured.

Do not commit the verification token into source files. Search Console verification and indexing are external Google account actions and cannot be completed automatically from the public GitHub repository alone.
