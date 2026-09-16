# TrendForge Supervisor — Phase 23

## Purpose

TrendForge Supervisor is the cross-phase operational manager for the V2 publishing system. It observes existing telemetry from Memory, Performance Intelligence, Learning, and Security + Reliability and produces an explainable health snapshot, bottlenecks, and bounded recommended actions.

## Mode

Phase 23 v1 is `advisory-observational` only.

The Supervisor does not:

- change publication gates;
- change evidence thresholds;
- change claim-verification thresholds;
- change safety gates;
- auto-publish articles;
- auto-rewrite articles;
- auto-delete articles;
- override an upstream phase decision.

Recommendations are diagnostics, not commands executed against the publishing loop.

## Inputs

- `data/trendforge-memory.json`
- `data/trendforge-performance.json`
- `data/trendforge-learning.json`
- `data/trendforge-security-reliability.json`

## Outputs

`data/trendforge-supervisor.json` contains:

- overall operational state (`healthy`, `watch`, or `attention`);
- phase health observations;
- current metrics;
- bottlenecks inherited from performance telemetry;
- AI provider issues;
- up to three explainable recommendations;
- source/version metadata.

## Safety contract

The Supervisor is deliberately downstream and observational in v1. Existing research, evidence, decision, writer, claim verification, editorial, safety, lifecycle, SEO, distribution, and monetization gates remain authoritative.

## Future scope

Later Supervisor versions may orchestrate explicitly permitted recovery workflows, but only through bounded, auditable actions that preserve the existing safety and publication contracts.
