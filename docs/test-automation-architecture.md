# Test Automation Architecture — The CTAL-TAE Map

This framework is a worked implementation of the ISTQB Certified Tester Advanced Level — Test Automation Engineer (CTAL-TAE v2.0) guidance. This page maps the framework onto the syllabus's **generic Test Automation Architecture (gTA)** so a reviewer can see the architecture decisions — and where each syllabus concern lives in the code.

## The gTA layers, as built here

The gTA separates a test automation solution into layers with distinct responsibilities. The framework's structure is that separation, literally:

| gTA layer | Responsibility | In this repo |
|---|---|---|
| **Test generation** | Deriving test cases from models and information about the SUT | The **recon module** (`src/support/recon/`): crawls the SUT, emits a validated application model; the **scaffold generator** turns the model into draft page objects and smoke specs (`generated/`) |
| **Test definition** | The testware itself: suites, data, libraries, page objects | `tests/` (pillar suites + proof suite), `src/pages/` (page objects), `src/fixtures.ts` (shared fixtures), test data created per-test through the API |
| **Test execution** | Running tests against the SUT and logging results | Playwright Test with one project per pillar (`playwright.config.ts`), the typed API client (`src/support/apiClient.ts`), the DB layer (`src/support/db.ts`) |
| **Test adaptation** | The interface between the automation and the SUT's technology | Page objects over accessible locators ([locator-strategy.md](locator-strategy.md)), self-healing locators (`src/support/selfHealing.ts`), chaos/fault injection (`src/support/chaos.ts`), the fixture-app adapter (`src/support/fixtureApp.ts`) |

Two syllabus rules are enforced structurally:

- **The SUT is only touched through the adaptation layer.** Specs never contain selectors; when the SUT's UI changes, the change is absorbed in `src/pages/` or the healing layer, not across the suite.
- **Test definition is independent of execution mechanics.** The same specs run against the fixture app or a real `BASE_URL`, in any CI platform, unchanged (see the tutorial's targeting model).

## TAE concerns and where they are answered

**Test automation strategy & pilot thinking.** The five pillars are the strategy made executable: each pillar is independently runnable, so adoption can be incremental (start with API + E2E; add DB, then perf/sec) instead of a big-bang suite. The proof suite is the pilot gate — the framework must demonstrate defect detection before it is trusted (see below).

**Metrics and reporting (TAE: collect the measures that drive decisions).** Three measures are first-class outputs, not afterthoughts: per-pillar results in the unified report; the **flakiness report** (first-attempt vs retry breakdown — retry-masked instability is the metric most suites hide); and **healing events**, logged on every self-heal so locator drift is measured as maintenance signal. The reporting standard they feed is [test-summary-report.md](test-summary-report.md).

**Maintainability.** Small, single-purpose support modules under `src/support/`; strict-by-default locators so failures are informative rather than auto-masked; Biome lint + full TypeScript typecheck as CI gates (Playwright transpiles without checking — the type gate is explicit). The unit project (`tests/unit/`) tests the support layer itself: the framework's own code is under test like any product code.

**Verifying the automation (the TAE "test the TAS" obligation).** The **proof suite / kill matrix** (`tests/proof/`, [expected-outcomes.md](expected-outcomes.md)): planted defects (mutants) in the fixture app must turn the right pillar red. A test automation solution that cannot demonstrate it catches the defects it exists to catch has not been verified — this suite is the verification, run in CI like everything else.

**CI/CD integration.** One gate contract (lint → typecheck → pillars → security audit → flakiness → evidence) implemented natively on GitHub Actions, GitLab CI, Azure Pipelines, Jenkins, and CircleCI (README, DevTestOps matrix). The architecture does not depend on any platform's proprietary features; platforms are interchangeable executors of the contract.

**Risk-based selection.** Which tests exist and which run when is decided by product risk, not habit — the register and scoring live in [risk-based-testing.md](risk-based-testing.md).

## What this map deliberately does not claim

- The gTA's **test management** tooling concerns (defect workflow, test case management systems) live in the companion documents — [master-bug-ticket.md](master-bug-ticket.md) and [master-test-plan.md](master-test-plan.md) — not in code, because they are process standards.
- No claim of ISTQB certification is made for this repository or its author by this page. It is an alignment map: the syllabus is the reference architecture, the repo is an implementation a reviewer can inspect against it.
