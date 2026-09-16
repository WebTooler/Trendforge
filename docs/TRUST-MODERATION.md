# TrendForge Phase 17 — Trust + Moderation

Phase 17 adds a trust and moderation foundation for the community layer without coupling moderation to article publication.

## Operating mode

- Provider: Utterances / GitHub
- Mode: advisory-only
- Enforcement: manual GitHub moderation
- The deterministic classifier recommends `allow`, `review`, or `block`.
- Phase 17 does not automatically hide, delete, lock, or ban comments.

## Deterministic signals

The first safety layer detects:

- link spam
- obvious repetition
- contact information / personal data patterns
- threat-like language
- abusive language
- impersonation patterns

These are moderation signals, not article-quality signals.

## Hard isolation contract

Trust + Moderation must never:

- change research or evidence
- change decision eligibility
- change writer behavior
- change editorial scoring
- change claim verification
- change quality or safety gates
- change lifecycle behavior
- change search or SEO
- change distribution or monetization
- change publication gates or thresholds
- rewrite or delete articles

Comment moderation is a community-safety function only.

## Phase 17 roadmap

1. Deterministic advisory classifier — implemented.
2. Isolation and regression tests — implemented.
3. Manual moderation workflow documentation — implemented.
4. Future moderation queue/dashboard can consume these signals without changing publishing behavior.

The current static GitHub Pages deployment has no central application database for comments, so automatic enforcement is deliberately not enabled in this phase.
