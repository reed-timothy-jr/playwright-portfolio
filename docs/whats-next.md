# What I'd Improve Next

Honest gaps, in priority order. This list is the interview cheat sheet —
it shows judgment about what matters, not just what shipped.

1. **Flaky-test quarantine** — detect tests that pass on retry, move them to a quarantine suite with an owner and a deadline instead of letting retries mask rot.
2. **Visual baselines for real app pages** — the committed baselines cover a deterministic fixture; real pages need per-environment baseline generation (`--update-snapshots` in CI).
3. **Axe-core on all critical flows** — currently login only; expand to checkout, forms, and error states.
4. **API auth flows** — token acquisition/refresh fixture, per-suite auth state, secret rotation via env.
5. **Test-data factories** — seeded, isolated data per test (no shared state), deterministic cleanup.
6. **Gherkin authoring layer** — Given/When/Then compiled to the same Playwright execution core (PRD §12).
7. **Allure reporting** — alongside the HTML report, for teams that already standardize on it.
8. **Lighthouse performance assertions** — beyond Navigation Timing, on critical flows, tracked per commit.
9. **AI failure-analysis agent** — wire the `HealingProvider` interface to a real model and log proposal quality (PRD §17).
10. **UI → API → DB combined specs** — the layers exist; wire a full-stack flow (API setup → UI action → DB verification) against a real backend.
