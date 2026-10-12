# Automation Testing — The 5-Star Standard

*Owner: Timothy Reed Jr. — Lead QA / SDET. Companion to the Manual Testing 5-Star Standard: manual testing discovers new risk; automation guards known risk at scale, forever, without being asked. This document is the quality bar for that guard duty — one star per testing type in the PowerBase portfolio.*

## The doctrine

**A test that cannot fail is not a test.** Every star below is earned the same way: the check is placed at the lowest level that can catch its defect class, it runs deterministically, it attaches evidence when it fails, and it has a demonstrated kill — a real or planted defect it is proven to catch. Green is not the goal. *Detection* is the goal; green is just what detection looks like on a healthy build.

## ⭐ Star 1 — E2E: workflows a user would swear by

Five-star end-to-end automation tests **user outcomes, not page mechanics**.

- Coverage is risk-ordered: authentication first (the gateway — if login breaks, nothing downstream is testable), then the flagship cross-layer workflow, then breadth.
- Locators follow the contract discipline (`docs/locator-strategy.md`): the primary locator is the agreement with the UI; self-healing recovers only unambiguous matches, logs every attempt, and never silently papers over an ambiguous page.
- No E2E test asserts what an API or DB check can assert faster and more precisely. The UI layer proves the layers work *together*; it is not a dumping ground for contract checks.
- Failure ships evidence automatically: screenshot, video, trace — a failed E2E run is debuggable without a re-run.
- *As built:* login suite + the flagship workflow (API creates data → UI operates on it → DB verifies → fault injected and recovery asserted → evidence attached → records cleaned up).

## ⭐ Star 2 — API: contracts, not status codes

Five-star API automation verifies **the agreement between systems**, not just that the server answered.

- Responses are schema-validated (Zod), not eyeballed: shape, types, and required fields are the contract.
- The matrix is complete per endpoint: success, creation semantics, 404 on the unknown, empty-set behavior, and error shapes that clients can actually handle.
- Negative space is tested as hard as the happy path — APIs are where integration bugs hide, and they hide in rejections.
- Calls run through a typed client, so a contract change breaks compilation before it breaks production.
- *As built:* `tests/api` — user contracts with validated responses, resource creation, 404 and empty-set cases, against a configurable target.

## ⭐ Star 3 — DB: the persistence truth

Five-star database automation answers the question UIs are worst at: **did the system actually keep what it claimed to keep?**

- Every important UI/API claim gets a persistence check behind it: seeded data is queryable, what was written is what is read back, unknowns stay unknown.
- Integrity rules are tested, not assumed: uniqueness enforced, constraints holding under the operations the UI performs.
- Test data is scoped per suite/worker, so parallel runs are isolated and repeatable — no shared-state mysteries, no order-dependent greens.
- Runs against an embedded database by default (PGlite) with a real-PostgreSQL lane available — deterministic on clone, honest against the real engine.
- *As built:* `tests/db` — seeded, scoped tables; persistence and uniqueness contracts; the flagship's DB leg verifies what its UI leg created.

## ⭐ Star 4 — Perf: budgets with teeth

Five-star performance automation in this portfolio is **budget enforcement**, stated honestly: it is not load testing.

- Every covered page carries explicit budgets for load time and TTFB, configurable per environment — a budget nobody set is a budget nobody enforces.
- Timing data is attached as evidence on every run, so a regression shows its numbers, not just a red X.
- Budgets fail the run when exceeded. A perf check that only reports is a chart, not a gate.
- The trend matters more than any single run: timing evidence accumulates so slow drift is visible before users feel it.
- *As built:* `tests/perf` — Navigation Timing budgets (load, TTFB) asserted on the login flow with timing attached as evidence.

## ⭐ Star 5 — Sec: the baseline, held every run

Five-star security automation here is a **regression baseline, not a pentest** — and it says so.

- Every run asserts the hygiene floor: security headers present, no server-technology leakage in responses.
- The auth boundary is probed each run: anonymous sessions and forged sessions are rejected from protected surfaces — the two failures that turn a bug into a breach.
- Dependency risk is gated, not noted: `npm run audit:sec` fails the pipeline on high-severity advisories.
- Baseline findings feed real security work; they never substitute for it. Anything this pillar surfaces beyond baseline goes to a human on the Master Bug Ticket standard, severity first.
- *As built:* `tests/sec` — header and leakage checks, anonymous/forged-session rejection, plus the audit gate.

## The cross-cutting rules (all five stars)

1. **Lowest level wins.** A check lives at the cheapest layer that catches its defect class — unit before API, API before DB, DB before E2E.
2. **Each pillar runs alone and green alone.** A suite that only passes inside the full run is itself a defect.
3. **Deterministic by default.** Fixture app, embedded DB, seeded data — green on clone with no network. External targets are an override, never a requirement.
4. **Kill-proven.** The proof suite and kill matrix plant defects and mutations the pillars must catch; a check with no demonstrated kill is a claim, not a control (see the Master Test Plan, §5 exit criteria).
5. **Flakiness is a defect, not weather.** Flakes are classified in the run report; quarantine is explicit, owned, and dated — never silent.
6. **Bounded chaos.** Fault injection is scoped, logged, and always restores state — resilience is proven without poisoning the run for everything after it.

## The 5-star checklist (per automated suite)

- [ ] Star earned per pillar above — checks placed at the lowest effective level
- [ ] Runs standalone (`npm run test:<pillar>`) and in `npm run verify`
- [ ] Evidence attached on failure (trace / payloads / timing / query results)
- [ ] Demonstrated kill in the proof suite or kill matrix
- [ ] Flakiness classified; nothing quarantined silently
- [ ] Claims in this document and the README still match the code — updated in the same commit when they change

## How the two standards fit

The Manual 5-Star Standard governs human discovery: charters, sessions, findings. This standard governs the machine guard: five pillars that catch what discovery found, on every run, with evidence. The loop between them is the whole system — **manual finds it once; automation guards it forever; the proof suite guarantees the guard is awake.**
