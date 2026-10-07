# What I'd Improve Next

Honest gaps, in priority order. This list is the interview cheat sheet —
it shows judgment about what matters, not just what shipped.

Done in the five-pillar restructure (2026-10-07) — no longer gaps:
- ~~Defect-detection proof suite~~ — `tests/proof/defect-detection.spec.ts` + `docs/expected-outcomes.md`
- ~~Explicit typecheck gate~~ — `tsc --noEmit` in `npm run verify` and CI (Playwright transpiles without type-checking)
- ~~Flagship API→UI→DB workflow~~ — `tests/e2e/flagship.workflow.spec.ts`
- ~~PGlite vs real-Postgres lanes~~ — `createDatabaseClient()`, documented in README
- ~~First-attempt vs retry visibility~~ — `scripts/report-flakiness.mjs`

Still open, in priority order:

1. **Flaky-test quarantine** — the flakiness report now *detects* retry-passes; next step is acting on them: move repeat offenders to a quarantine suite with an owner and a deadline instead of letting retries mask rot.
2. **Visual baselines for real app pages** — the committed baselines cover a deterministic fixture; real pages need per-environment baseline generation (`--update-snapshots` in CI).
3. **Axe-core on all critical flows** — currently login only; expand to forms and error states.
4. **API auth flows** — token acquisition/refresh fixture, per-suite auth state, secret rotation via env.
5. **Test-data factories** — seeded, isolated data per test (no shared state), deterministic cleanup. (The flagship workflow hand-rolls this today.)
6. **Gherkin authoring layer** — Given/When/Then compiled to the same Playwright execution core (PRD §12).
7. **Allure reporting** — alongside the HTML report, for teams that already standardize on it.
8. **Lighthouse performance assertions** — beyond Navigation Timing, on critical flows, tracked per commit.
9. **AI failure-analysis agent** — wire the `HealingProvider` interface to a real model and log proposal quality (PRD §17).
10. **Expand the sec pillar** — OWASP ZAP baseline scan in CI, dependency policy beyond `npm audit`, secret-scanning hook.
