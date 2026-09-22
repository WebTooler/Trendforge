# Claim Verifier Phase 0 — Run 400 baseline

This fixture is the controlled baseline for the Claim Verification repair sequence.

## Source

- GitHub Actions run: 35693274596
- Artifact: trendforge-article-attempt-400
- Article: Meta’s Muse AI assistant faces zero-day breach that lets apps take full control

## Baseline observed

- Writer: PASS
- Factual claims seen by verifier: 14
- Verifier marked unsupported: 13
- Verifier marked verified: 1
- Manual review found genuinely unsupported factual claims: 0
- Manual review found supported factual claims: 11
- Manual review found partial/synthesis claims: 2
- Editorial/advice claims: 3
- Grounding repair: triggered

## What this fixture protects

The important failure signature is not simply the final count. The verifier can identify a high-scoring fact match but attach an unrelated passage. The fixture therefore records immutable source/passsage provenance for representative claims.

Phase 0 must not change verifier behavior or production thresholds. Phase 1+ changes should make the verifier resolve the recorded claims through their declared source/passage provenance.

## Rule

Do not use this fixture to justify lowering evidence thresholds. The target is correct evidence mapping, not easier publication.
