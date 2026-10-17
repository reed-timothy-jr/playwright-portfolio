# Risk-Based Testing — Register and Method

Testing everything equally is testing nothing well. This register applies the ISTQB risk-based approach (CTFL v4.0 Ch. 5): identify **product risks**, score them by likelihood and impact, and let the scores decide what gets tested first, deepest, and on every change. The worked register below covers this repo's domain (an account/login system with a JSON API and stored user records — the fixture app's shape, and a fair model of most client systems). The method transfers to any application; the rows get replaced, the scoring doesn't.

## Scoring

- **Likelihood** (1–3): how probable is this failure in the wild — history, complexity, change rate.
- **Impact** (1–3): harm if it ships — security exposure and data loss outrank cosmetic damage.
- **Exposure = Likelihood × Impact.** Test order, depth, and CI frequency follow exposure: 9s gate every change, mid scores gate merges, low scores run nightly or per release.

## The register

| # | Product risk | L | I | Exp | Primary coverage | Where it runs |
|---|---|---|---|---|---|---|
| R1 | Authentication accepts invalid credentials or rejects valid ones (login logic error) | 2 | 3 | 6 | Decision table (all 4 rules) + EP login specs | `tests/e2e/login.decision-table.spec.ts`, `login.spec.ts` — every change |
| R2 | Session persists after logout / protected pages render unauthenticated | 2 | 3 | 6 | State transition specs (logout kills session; /secure bounces anonymous) | `tests/e2e/secure-area.auth.spec.ts` — every change |
| R3 | API validation silently weakens (length/rules dropped in a refactor) | 2 | 3 | 6 | BVA rows on both length rules; `weak-password` mutant must die | `tests/api/users.bva.spec.ts`, proof suite — every change |
| R4 | API returns success but data is not persisted (or wrong record stored) | 2 | 3 | 6 | DB pillar independent verification; flagship API→UI→DB flow | `tests/db/`, `tests/e2e/flagship.workflow.spec.ts` — every change |
| R5 | Contract drift: response shapes change without consumers noticing | 3 | 2 | 6 | Zod contract assertions on every API exchange | `tests/api/`, flagship step 1 — every change |
| R6 | Duplicate/conflicting accounts created under retry or double-submit | 2 | 2 | 4 | Duplicate-username 409 spec (EP class) | `tests/api/users.spec.ts` — merge gate |
| R7 | Flows degrade past usability under latency (auth provider slowness) | 2 | 2 | 4 | Chaos latency spec with recovery assertion + interception proof | Flagship step 4, `tests/proof/chaos.spec.ts` — merge gate |
| R8 | Key pages regress visually or lose accessibility (unlabeled fields, contrast) | 3 | 2 | 6 | A11y project (axe + labeled-control checks) + visual regression | `tests/a11y/`, `tests/visual/` — merge gate |
| R9 | Performance budget breach on the critical path (login) | 2 | 2 | 4 | Perf pillar budgets | `tests/perf/login.perf.spec.ts` — merge gate |
| R10 | Security headers / baseline protections missing | 1 | 3 | 3 | Sec pillar header + auth-baseline specs | `tests/sec/` — merge gate |
| R11 | A locator rot wave breaks the suite itself (framework risk, not product) | 3 | 1 | 3 | Strict-by-default locators + logged healing events; flakiness report | Support layer, CI report — per release review |

## How the register drives the work

1. **Entry order.** New testing starts at the highest uncovered exposure. If R1–R5 are not covered, nothing else gets built first — this register is the backlog's priority order.
2. **CI frequency.** Exposure 6+ suites are in `test:all` and gate every change on every platform; exposure ≤ 4 suites still gate merges; nothing in the register is "manual only."
3. **Defect feedback loop.** Every escaped defect updates a row: the likelihood score was wrong, or the coverage was thinner than claimed. The register is re-scored each release in the [test summary report](test-summary-report.md) cycle.
4. **Residual risk is stated, not hidden.** Risks accepted without coverage must appear in the summary report's coverage-gap section with an owner. An unscored risk is an unknown; a scored, accepted risk is a decision.

## Extending it to a client application

Replace the rows with the client's product risks (payments, PII handling, regulatory flows outrank everything consumer-facing), keep the 3×3 scoring for the first pass — finer scales mostly manufacture precision nobody can defend — and map each row to the pillar that can actually observe the failure. If no pillar can observe it, that is the first automation gap to close, and it goes on [whats-next.md](whats-next.md), not in a slide deck.
