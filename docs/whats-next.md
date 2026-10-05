# What I'd Improve Next

Honest gaps, in priority order. This list is the interview cheat sheet —
it shows judgment about what matters, not just what shipped.

1. **DB validation layer** — `src/framework/db.ts` with Postgres/MySQL adapters; UI → API → DB consistency checks in one spec (PRD §15).
2. **Flaky-test quarantine** — detect tests that pass on retry, move them to a quarantine suite with an owner and a deadline instead of letting retries mask rot.
3. **Visual regression baselines** — Playwright screenshot comparisons per browser, checked into the repo, diffed in CI.
4. **Accessibility assertions** — Axe-core integration on critical flows; fail on critical violations, warn on the rest.
5. **API auth flows** — token acquisition/refresh fixture, per-suite auth state, secret rotation via env.
6. **Test-data factories** — seeded, isolated data per test (no shared state), deterministic cleanup.
7. **Gherkin authoring layer** — Given/When/Then compiled to the same Playwright execution core (PRD §12).
8. **Allure reporting** — alongside the HTML report, for teams that already standardize on it.
9. **Performance budgets** — Lighthouse-style assertions on critical flows, tracked per commit.
10. **AI failure-analysis agent** — wire the `HealingProvider` interface to a real model and log proposal quality (PRD §17).
