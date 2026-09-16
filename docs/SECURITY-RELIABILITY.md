# TrendForge Phase 22 — Security + Reliability

Phase 22 protects the publishing system without changing editorial decisions.

## Mode

`protective-observational`

The layer audits configuration, known credential patterns, critical build outputs, workflow presence, and production-export integrity.

## Isolation contract

Security + Reliability does not change publication gates, thresholds, research, evidence, writer, editorial intelligence, claim verification, or safety decisions. It does not auto-delete files or auto-modify publishing decisions.

## Current checks

- Required package/build configuration
- Reliability workflow presence
- Workflow inventory
- Known credential-pattern scan
- Production static output presence
- Required index/robots/sitemap outputs
- Secret-named build-file scan

## Future hardening

Future iterations can add dependency auditing, workflow pinning review, integrity manifests, failure recovery diagnostics, and broader secret detection while preserving the isolation contract.
