# Image V3 Editorial QA — Run 13 Candidates

Status: **HOLD — not production-ready**

These are the saved Run #13 candidates already attached to the three test articles. No new Cloudflare generation is performed by this review.

| Candidate | Story relevance | Composition | Artifact review | Decision |
|---|---|---|---|---|
| Apple AI server | Strong | Strong | Small pseudo-text-like detail observed on a background display | HOLD |
| Android password/passkey transfer | Strong | Strong | Small pseudo-label/brand-like detail observed | HOLD |
| Drone threats / AI vulnerabilities | Strong | Strong | Facility/signage-like pseudo-label detail observed | HOLD |

## Gate policy

1. Technical checks are automated: file presence, JPEG signature, 1024x576 dimensions, minimum file size, exact SHA-256 uniqueness, and OCR text detection when Tesseract is available.
2. Editorial visual checks are separate: story relevance, focal hierarchy, factual visual grounding, fake logos/brand marks, pseudo-readable text, and thumbnail composition.
3. A candidate must not enter the production pipeline unless both technical QA and vision-capable editorial QA pass.
4. If a future generation fails editorial QA, allow up to three attempts; after the final failure, use the existing deterministic SVG fallback rather than blocking the publication pipeline indefinitely.
5. Cloudflare generation must remain disabled while its free allocation is exhausted; this QA workflow never calls the image-generation API.
