# PowerBase Playwright Framework

> A base test framework for enterprise applications — from small/medium businesses to large teams — and a senior-SDET portfolio piece.

Five testing pillars — **e2e, api, db, perf, sec** — each runnable on its own. Around them, a supporting layer (self-healing locators, chaos engineering, evidence capture) that serves the pillars instead of competing with them. While standard frameworks just *check* your app, PowerBase **proves it can find defects** — see the [defect-detection proof suite](docs/expected-outcomes.md).

[![CI](https://github.com/Reed-Timothy-jr/powerbase-playwright-framework/actions/workflows/ci.yml/badge.svg)](https://github.com/Reed-Timothy-jr/powerbase-playwright-framework/actions/workflows/ci.yml)
![Playwright](https://img.shields.io/badge/Playwright-1.55-2EAD33)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6)
![License](https://img.shields.io/badge/license-MIT-green)

## The five pillars

| Pillar | What it covers | Run it | What "good" looks like |
|---|---|---|---|
| **e2e** | Critical user paths through the UI (login, authenticated flows, the flagship API→UI→DB→fault workflow) | `npm run test:e2e` | Green on every PR; page objects read like the user story |
| **api** | Contract-level checks: Zod-validated responses, resource creation, 404/empty-set behavior | `npm run test:api` | Schemas catch backend drift that status codes miss |
| **db** | The persistence contract: seed → act → verify, constraint enforcement | `npm run test:db` | Same specs pass on PGlite (fast lane) and real Postgres (integration lane) |
| **perf** | Page-load and time-to-first-byte budgets via the Navigation Timing API | `npm run test:perf` | Budgets in env (`PERF_BUDGET_LOAD_MS`); timing attached as evidence |
| **sec** | Baseline security: response headers, authz boundaries, dependency audit | `npm run test:sec` | Missing headers fail the build; forged sessions bounced |

```bash
npm run test:pillars   # all five pillars
npm run test:all       # pillars + supporting suites (a11y, visual, unit)
npm run test:proof     # defect-detection proof suite (evidence, not regression)
npm run verify         # lint + typecheck + test:all — the full gate
```

## Supporting layer

Nice-to-haves that serve the pillars — in `src/support/`:

| Support | What it does | Serves |
|---|---|---|
| **Self-healing locators** | Ordered fallback strategies when the primary locator breaks; heals ONLY on unambiguous matches — ambiguous matches are rejected and logged, never silently healed | e2e stability |
| **Chaos engineering** | Bounded fault injection: latency, error-rate aborts, offline, CPU throttle, storage wipes; experiments always restore state | e2e/perf resilience proofs |
| **Typed API client** | Dependency-free `fetch` wrapper (GET/POST/PUT/PATCH/DELETE) with timeouts and header merging | api pillar, flagship workflow |
| **Evidence** | Screenshots, DOM snapshots, structured JSON (healing events, chaos logs, API payloads) attached to every report | every failure |
| **Page objects** | `src/pages/` — named locators, action methods that read like the user story | e2e pillar |
| **Accessibility** | axe-core, critical/serious WCAG 2.0A/2.1AA (`npm run test:support`) | quality scope |
| **Visual regression** | Deterministic fixture baselines (`npm run test:support`) | quality scope |

## Quickstart

```bash
npm install
npx playwright install chromium
cp .env.example .env

npm run test:e2e    # UI critical path (bundled fixture app — no network needed)
npm run test:api    # API contract checks
npm run test:sec    # baseline security checks
npm run verify      # the whole gate
npm run report      # open the HTML report
```

**Target app:** web-app specs run against the **bundled fixture demo app** by default — a tiny login flow + JSON API backed by in-process Postgres, started per worker. Deterministic, offline-safe, green on clone. Set `BASE_URL` to run the same specs against your own app instead (it must expose a compatible login flow).

**Database lanes:** `createDatabaseClient()` picks the lane — PGlite in-process by default; set `DB_HOST` (+ `DB_USER`, `DB_PASSWORD`, `DB_NAME`) for the real-Postgres integration lane. Same specs, same interface.

## Environment notes

- **Restricted networks:** the e2e/perf/sec/a11y pillars run against the bundled fixture app — no external network needed, ever. The api pillar targets `API_BASE_URL` (default: jsonplaceholder); if your environment blocks outbound HTTP POST, the suite's preflight probe skips the POST-dependent spec loudly instead of failing. The client's POST path is still covered by `tests/unit/apiClient.unit.spec.ts` and the flagship workflow.
- **Dependency audit:** `npm run audit:sec` fails the build on high+ severity advisories. Some sandboxes block the npm audit endpoint — CI runs it; run it locally where the registry is reachable.

## Project structure

```
src/
  support/        # the supporting layer: selfHealing, chaos, apiClient,
                  #   db, evidence, config, fixtureApp
  pages/          # page objects (your app goes here)
  fixtures.ts     # test.extend wiring (api, chaos, appTarget)
tests/
  auth.setup.ts   # logs in once, saves storage state for e2e-auth
  e2e/            # E2E pillar (incl. flagship.workflow.spec.ts)
  api/            # API pillar
  db/             # DB pillar
  perf/           # PERF pillar
  sec/            # SEC pillar
  a11y/           # supporting: accessibility
  visual/         # supporting: visual regression
  proof/          # defect-detection proof suite (evidence, not regression)
  unit/           # focused tests for the framework primitives
docs/
  adr-001-why-playwright.md
  adr-002-five-pillars.md
  locator-strategy.md
  expected-outcomes.md   # defect-detection scenario map
  whats-next.md          # honest gap list, in priority order
scripts/
  report-flakiness.mjs   # first-attempt vs retry breakdown
```

## Why these tests

Each pillar exists for a risk reason, not a coverage number:

- **e2e/login** — authentication is the gateway to every other flow. If login breaks, nothing downstream is testable.
- **e2e/flagship** — the one scenario that proves the layers work together: API creates data → UI operates on it → DB verifies persistence → a fault is injected and recovery asserted → evidence attached → owned records cleaned up.
- **api/users** — contract checks: Zod-validated responses, resource creation, 404 and empty-set behavior. APIs are where integration bugs hide.
- **db/users** — the persistence contract: seeded data is queryable, unknowns stay unknown, uniqueness enforced. Scoped tables keep parallel workers isolated.
- **perf/login** — load and TTFB against env-configurable budgets, timing attached as evidence.
- **sec/headers + sec/auth** — baseline hygiene: security headers present, no server-tech leakage, anonymous and forged sessions rejected. Baseline, not a pentest.
- **proof/defect-detection** — the credibility suite: planted defects (ambiguous UI, broken API contract, false-positive UI) that the framework must *detect*. Green here means the framework can find bugs, not just pass.

## Design principles

1. **Pillars first, features second.** The five testing modules are the product; everything else exists to make them stronger.
2. **The primary locator is the contract.** Healing recovers the run on unambiguous matches only — ambiguous matches are rejected and logged, never silently healed. Strict mode fails fast on an ambiguous primary.
3. **Evidence over assumptions.** Every failure attaches screenshots, DOM, and structured JSON. A recovered test is always distinguishable from a clean pass in the audit log.
4. **Deterministic by default.** Fixture app, PGlite, seeded data — green on clone with no network. External targets are an override, not a requirement.
5. **Chaos stays bounded.** Fault injection is scoped by URL pattern, logged, always restores state — even when the test body throws.

## What I'd improve next

See [docs/whats-next.md](docs/whats-next.md) — the honest gap list, in priority order.

## Author

**Timothy Reed** — Senior QA / SDET (Playwright + TypeScript), 11+ years across Catalyte and GEICO.
[LinkedIn](https://www.linkedin.com/in/timothy-reed-jr) · [timinit.org](https://timinit.org)

MIT licensed — use it, fork it, ship it.
