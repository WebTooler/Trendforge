# TrendForge Newsletter

TrendForge is a static GitHub Pages site, so subscriber addresses should not be stored in the repository or in a custom server database.

The newsletter UI is provider-neutral. It reads the public build-time variable `NEXT_PUBLIC_NEWSLETTER_FORM_ACTION` and posts the email with a normal HTML `POST` form. No API key or subscriber database is exposed in the browser.

## Recommended setup

Use a newsletter provider that supports a static HTML form endpoint. Buttondown documents an HTML embed endpoint specifically for static/JAMstack sites and recommends a normal form POST rather than `fetch`, because subscribers may need to follow a CAPTCHA or validation response.

For Buttondown, the action format is:

`https://buttondown.com/api/emails/embed-subscribe/YOUR-BUTTONDOWN-USERNAME`

Set this as the GitHub Actions repository variable:

`NEXT_PUBLIC_NEWSLETTER_FORM_ACTION`

Path in GitHub: **Settings → Secrets and variables → Actions → Variables**.

Do not put a provider API token in the repository or in a `NEXT_PUBLIC_` variable. The site only needs the provider's public form action URL.

## Current fallback

If the variable is not configured, TrendForge shows the newsletter-ready state and keeps RSS available. The site does not pretend that email signup is active until a provider is connected.

## Privacy model

- TrendForge does not store subscriber email addresses.
- The browser posts the address directly to the configured provider.
- RSS subscriptions remain with the user's RSS reader.
- The form includes the `trendforge-website` tag so a compatible provider can identify website signups.
