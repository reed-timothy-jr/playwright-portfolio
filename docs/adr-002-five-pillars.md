# ADR-002: Five pillars — e2e, api, db, perf, sec

**Date:** 2026-10-07
**Status:** Accepted
**Supersedes:** the feature-catalog layout (self-healing / chaos / api / db / a11y / visual / perf as peers)

## Context

The framework had grown into a catalog of impressive features with no
center: self-healing locators, chaos engineering, API client, DB layer,
accessibility, visual regression, performance budgets — all peers. Two
problems:

1. **For teams adopting it** (including small/medium businesses): no clear
   answer to "what do I get?" — a buyer thinks in testing *types*
   (e2e, api, db, perf, sec), not framework *mechanisms*.
2. **For readers evaluating it**: a feature catalog reads as breadth
   without judgment. The structure should show what the author considers
   the load-bearing walls.

## Decision

Concentrate the repo on five testing modules — **e2e, api, db, perf, sec** —
each independently runnable (`npm run test:<pillar>`). Everything else
(self-healing, chaos, evidence, a11y, visual) becomes an explicitly
labeled *supporting layer* (`src/support/`, supporting test projects) that
serves the pillars.

## Why these five

- **e2e** — the user path. What the business actually sells.
- **api** — where integration bugs hide; the cheapest place to catch them.
- **db** — the persistence contract; the difference between "the UI said
  so" and "it actually happened."
- **perf** — budgets are the only perf tests that survive contact with CI.
- **sec** — baseline headers + authz boundaries. Framed honestly as
  baseline hygiene, not a pentest — but its absence is the most common
  enterprise gap, and demonstrating it signals senior judgment.

Accessibility and visual regression stay as supporting suites: valuable,
but not the five every engagement needs on day one.

## Consequences

- `playwright.config.ts` defines one project per pillar; CI runs them via
  `test:all`. Supporting suites (a11y, visual) and the `proof`/`unit`
  projects are separate.
- The `proof` project (defect-detection suite) is intentionally excluded
  from `test:all` — it demonstrates failure scenarios and is reviewed as
  evidence via `npm run test:proof`.
- Web-app specs target the bundled fixture demo app by default
  (`src/support/fixtureApp.ts`); `BASE_URL` overrides to a real target.
  Deterministic and offline-safe beats demo-app realism for a base framework.
- Feature work is now judged by one question: *which pillar does this
  make stronger?*
