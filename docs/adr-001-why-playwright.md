# ADR-001: Why Playwright (+ TypeScript) is the execution core

**Date:** 2026-10-04
**Status:** Accepted

## Context

PowerBase needs a deterministic execution engine underneath the AI layer. Candidates: Playwright, Cypress, WebdriverIO, Selenium.

## Decision

Playwright with TypeScript.

## Rationale

1. **Auto-waiting and web-first assertions** remove the largest source of flakiness in UI suites — the framework waits for actionability instead of the test author guessing timeouts.
2. **One API for Chromium, Firefox, and WebKit** — cross-browser without a grid vendor.
3. **Built-in network interception** (`page.route`) is the primitive the chaos/fault-injection layer is built on. No plugin required.
4. **Trace viewer, screenshots, and video** are first-class — the evidence engine gets them for free.
5. **TypeScript strict mode** catches locator/payload contract drift at compile time — the kind of defect class a test framework exists to surface early.

## Consequences

- The framework assumes a Node.js runtime for execution; the Docker image pins it.
- AI features (healing proposals, failure analysis) sit *above* this layer via the `HealingProvider` interface — the deterministic core never depends on a model.
