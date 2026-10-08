# ADR-001: Why Playwright (+ TypeScript) is the execution core

**Date:** 2026-10-04
**Status:** Accepted

## Context

PowerBase needs a deterministic execution engine underneath the AI layer. Candidates: Playwright, Cypress, WebdriverIO, Selenium.

## Decision

Playwright with TypeScript.

## Rationale

1. **Auto-waiting and web-first assertions** remove the largest source of flakiness in UI suites — the framework waits for actionability instead of the test author guessing timeouts.
2. **One API for Chromium, Firefox, and WebKit** — cross-browser without a grid vendor. (The default config runs Chromium for speed; add `devices['Desktop Firefox']` / `['Desktop Safari']` projects to extend the matrix — nothing in the framework is Chromium-specific except the CDP CPU-throttle fault.)

## Why not the built-ins?

Three fair questions, answered once:

- **Why a hand-rolled ApiClient instead of Playwright's `request`?** The client is runtime-agnostic: it works in Playwright specs, in `scripts/` CLIs, and in the recon tooling — anywhere Node runs. Playwright's `APIRequestContext` ties API checks to the test runner and can't be reused outside it. The tradeoff (no trace integration for API calls, no automatic proxy handling) is documented in `src/support/apiClient.ts`.
- **Why a healing chain instead of `locator.or()`?** `or()` composes alternatives but can't enforce the ambiguity rule (exactly one match or reject), keep an audit log, or bound attempts. The healing module is a policy engine, not just a fallback list.
- **Why a fixture app instead of Playwright's `webServer`?** `webServer` starts *your* app; the fixture app *is* a demo target with a known API + UI + Postgres shape, so the repo runs green on clone with zero setup. Point `BASE_URL` at your own app (served however you like, `webServer` included) to replace it.
3. **Built-in network interception** (`page.route`) is the primitive the chaos/fault-injection layer is built on. No plugin required.
4. **Trace viewer, screenshots, and video** are first-class — the evidence engine gets them for free.
5. **TypeScript strict mode** catches locator/payload contract drift at compile time — the kind of defect class a test framework exists to surface early.

## Consequences

- The framework assumes a Node.js runtime for execution; the Docker image pins it.
- AI features (healing proposals, failure analysis) sit *above* this layer via the `HealingProvider` interface — the deterministic core never depends on a model.
