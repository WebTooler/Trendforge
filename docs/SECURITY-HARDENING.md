# TrendForge Security Hardening

TrendForge is deployed as a static Next.js export on GitHub Pages. Application-server response headers cannot be configured at runtime, so compatible hardening is applied in the document head.

## Policies enabled

- Content Security Policy limiting scripts, frames, connections, forms, images, fonts, and object content to required sources.
- Referrer Policy: `strict-origin-when-cross-origin`.
- MIME-sniffing protection via `X-Content-Type-Options: nosniff` where the host honors document meta policies.
- Permissions Policy disabling camera, microphone, geolocation, payment, and USB access.
- CSP `object-src 'none'`, `base-uri 'self'`, `form-action` restricted to the site and Buttondown, and HTTPS upgrade enforcement.

## Static-hosting limitation

GitHub Pages does not provide general `_headers` response-header configuration for this site. Policies that must be HTTP response headers—especially `Strict-Transport-Security`, `X-Frame-Options`, and server-level CSP enforcement—cannot be guaranteed by application code alone on the current host.

When TrendForge moves to a host with configurable response headers, add these at the hosting layer and keep the CSP aligned with the actual third-party services in use.

## Maintenance

When adding a third-party script, iframe, image host, API, font, or form provider, review the CSP before deployment. Do not add broad wildcards unless required and documented.
