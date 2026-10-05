# PowerBase Playwright Framework

> While standard frameworks just *check* your app, PowerBase **analyzes, heals, and stress-tests** it.

A senior-grade Playwright + TypeScript starter framework: self-healing locators, chaos-engineering fault injection, typed API client, evidence-rich reporting, Docker one-liner, and CI out of the box. Built as a portfolio showpiece — and as a drop-in starter kit for any new engagement.

[![CI](https://github.com/reedtimothyjr-ai/powerbase-playwright-framework/actions/workflows/ci.yml/badge.svg)](https://github.com/reedtimothyjr-ai/powerbase-playwright-framework/actions/workflows/ci.yml)
![Playwright](https://img.shields.io/badge/Playwright-1.55-2EAD33)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6)
![License](https://img.shields.io/badge/license-MIT-green)

## What's inside

| Area | What you get |
|---|---|
| **Self-healing locators** | `src/framework/selfHealing.ts` — primary locator + ordered fallback strategies (role, text, CSS). Every healing event is logged with before/after strategy. Optional AI provider hook (any LLM) as a last resort — deterministic strategies always run first. |
| **Chaos engineering** | `src/framework/chaos.ts` — bounded fault injection: latency, error-rate aborts, intercepted-request logging, start/stop controls. |
| **API testing** | `src/framework/apiClient.ts` — typed, dependency-free client (GET/POST/PUT/PATCH/DELETE) with status + body + header assertions. |
| **Evidence** | `src/framework/evidence.ts` — screenshots, DOM snapshots, and structured JSON attached to every report. Failures ship with proof. |
| **Page objects** | `src/pages/` — named locators, action methods that read like the user story. |
| **Fixtures** | `src/fixtures.ts` — `api` + `chaos` fixtures on every test, auto-cleaned. |
| **CI** | `.github/workflows/ci.yml` — typecheck → smoke → API → resilience, HTML report artifact. |
| **Docker** | `Dockerfile` — `docker build -t powerbase . && docker run powerbase`. |

## Quickstart

```bash
npm install
npx playwright install chromium   # or --with-deps on Linux
cp .env.example .env              # point BASE_URL at your app

npm run test:smoke        # UI critical path
npm run test:api          # API contract checks
npm run test:resilience   # self-healing + chaos demos
npm test                  # everything, all browsers
npm run report            # open the HTML report
```

The example suites run against stable public targets (`the-internet.herokuapp.com`, `jsonplaceholder.typicode.com`) so the repo is green on clone. Point `BASE_URL` / `API_BASE_URL` at your app and write page objects in `src/pages/`.

## Project structure

```
src/
  framework/      # the reusable core: self-healing, chaos, API client, evidence, config
  pages/          # page objects (your app goes here)
  fixtures.ts     # test.extend wiring
tests/
  smoke/          # critical path, runs on every PR
  api/            # contract-level API checks
  resilience/     # self-healing + chaos engineering demos
```

## Why these tests

Each suite exists for a risk reason, not a coverage number:

- **smoke/login** — authentication is the gateway to every other flow. If login breaks, nothing downstream is testable, so it runs on every PR.
- **api/users** — contract checks: typed responses (Zod-validated), resource creation, and 404 behavior. APIs are where integration bugs hide.
- **resilience/self-healing** — locator rot is the #1 killer of UI suites. This suite proves the framework recovers from a stale selector *and* logs the healing as evidence.
- **resilience/chaos** — happy-path green means little if the app collapses under latency or 5xx responses. Fault injection verifies recovery behavior.

## What I'd improve next

See [docs/whats-next.md](docs/whats-next.md) — the honest gap list, in priority order: DB validation layer, flaky-test quarantine, visual baselines, Axe accessibility, API auth flows, test-data factories, Gherkin layer, Allure, performance budgets, AI failure-analysis agent.

## Design principles

1. **The primary locator is the contract.** Healing recovers the run; it never silently rewrites the suite — healed locators need human approval to be committed.
2. **Evidence over assumptions.** Every failure attaches screenshots, DOM, and structured JSON (healing events, chaos interceptions).
3. **Deterministic first, AI last.** Fallback strategies run before any LLM hook, and the model is replaceable.
4. **Chaos stays bounded.** Fault injection is scoped by URL pattern, logged, and never pointed at production without approval.

## Roadmap

- [ ] DB validation layer (Postgres/MySQL adapters, UI→API→DB consistency checks)
- [ ] Gherkin/BDD authoring layer over the same execution core
- [ ] Visual regression module
- [ ] Performance budgets (Lighthouse-style)
- [ ] AI failure-analysis agent (see [PowerBase AI PRD](https://github.com/reedtimothyjr-ai/PowerBasePlaywright))

## Author

**Timothy Reed** — QA Engineer (Playwright + TypeScript), 7+ years across Catalyte and GEICO.
[LinkedIn](https://www.linkedin.com/in/timothy-reed-jr) · [timinit.org](https://timinit.org)

MIT licensed — use it, fork it, ship it.
