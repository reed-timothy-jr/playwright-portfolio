# Master Test Plan — PowerBase Playwright Framework

*Owner: Timothy Reed Jr. — Lead QA / SDET. Status: living document; reviewed at every release gate.*

## 1. Purpose

This plan governs all testing for the PowerBase Playwright framework and the products built on it. It defines what gets tested, at which level, with what evidence, and what "done" means — so quality decisions are made from this document, not from habit.

Guiding doctrine: **deterministic systems verify; humans (and later, AI agents) reason about the results.** A test that cannot fail is not a test. Every suite in this plan has a demonstrated kill: a mutation or defect it is proven to catch.

## 2. Scope

### In scope — the five pillars

| Pillar | Command | Covers |
|---|---|---|
| E2E | `npm run test:e2e` | User workflows end-to-end in Chromium against the target app |
| API | `npm run test:api` | HTTP contracts: status, schema, auth rejection, error shapes |
| DB | `npm run test:db` | Persistence truth: what the UI claims vs what the database holds |
| Perf | `npm run test:perf` | Navigation Timing budgets (load, TTFB) per page class |
| Sec | `npm run test:sec` | Security headers, unauthenticated-access rejection, `npm run audit:sec` |

Plus the supporting layer: accessibility (Axe, WCAG 2.1 tags), visual regression, self-healing locator behavior, chaos/fault injection, and the flagship cross-pillar workflow (API → UI → DB → fault → evidence → cleanup).

### Out of scope

- Browsers other than Chromium (until the cross-browser milestone lands; the plan is updated, not bent, when it does).
- Load/stress testing beyond Navigation Timing budgets — perf pillar asserts page budgets, not concurrency.
- Manual exploratory testing process — governed by the companion **Manual Testing 5-Star Standard** (`docs/manual-testing-5-star.md`).

## 3. Test levels and where a check belongs

1. **Unit** — support-layer logic (locator healing, PRNG-seeded chaos, API client) tested in isolation.
2. **Pillar suites** — each pillar runs alone and green alone; a pillar that only passes inside the full run is a defect in the suite.
3. **Cross-pillar flagship** — one business workflow proven across API, UI, and DB with fault injection mid-flight and evidence captured end-to-end.
4. **Proof suite** — defect-detection tests and the kill matrix: fixture-app mutants (`skip-persist`, `weak-password`, `no-auth-redirect`, unauthenticated DELETE) must turn the relevant pillar red. Run before any release; a mutant that survives blocks the release.

Rule of placement: a check lives at the **lowest level that can catch its defect class**. UI tests never assert what an API or DB check can assert faster and more precisely.

## 4. Entry criteria

- Target build deploys and passes smoke (recon-generated smoke specs or the pillar smoke subset).
- Test data plan exists for the suite being run (seeded fixture data or factories; no hand-made shared state).
- Environment is declared: base URL, browser, data mode. A result without an environment is not a result.

## 5. Exit criteria (release gate)

- `npm run verify` green: lint, typecheck, all pillars.
- Proof suite green: every kill-matrix mutant caught.
- Zero open **critical/high** defects; mediums carry a written risk acceptance.
- Flakiness report reviewed: no test enters quarantine silently; quarantined tests are listed in the run report with an owner and a date.
- Evidence bundle complete for the flagship workflow (trace, screenshots, API/DB records).

## 6. Test data strategy

- Default target is the bundled fixture application with seeded data — deterministic, disposable, offline-capable.
- Real-target runs (e.g., the AcademyBugs benchmark) use versioned expected-state snapshots; site drift surfaces as a diff for human review, never auto-accepted.
- No production data in any test environment. Credentials live in environment variables / storage state files that are gitignored, never in specs.

## 7. Defect management

- Every defect is filed on the **Master Bug Ticket** standard (`docs/master-bug-ticket.md`): evidence first, observed facts separated from inference.
- Severity by user impact and detectability, not by reporter volume.
- A defect is closed by a failing-then-passing test at the lowest level that catches it, linked in the ticket — not by a comment saying "works now."

## 8. Evidence and reporting

Every run produces: pass/fail by pillar, flakiness classification (including Playwright `flaky` status), traces on failure (`retain-on-failure`), and the flagship evidence bundle. Reports answer three questions in order: **what ran, what failed, what proves it.**

## 9. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Flaky UI tests erode trust in the gate | Strict-locator discipline (`docs/locator-strategy.md`), flakiness report, quarantine with owner/date |
| Self-healing masks a real regression | Healing is strict-by-default, logged per attempt, and heals are reviewed as diffs |
| Suite passes while the product is broken | Kill matrix + proof suite as a release gate (§5) |
| Claims drift from code | This plan and the README are updated in the same commit as the behavior they describe |

## 10. Review cadence

This plan is reviewed at each release gate and whenever a pillar, target, or gate changes. Changes land as commits to this file with the code they describe.
