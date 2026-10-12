# Master Bug Ticket — Defect Report Standard

*Owner: Timothy Reed Jr. — Lead QA / SDET. Every defect filed on any project follows this format. A ticket that skips a required field is sent back, not triaged.*

## The rule

**Evidence first; observed facts and inference never mix.** The reader must be able to reproduce the defect from the ticket alone, and must always be able to tell what was *seen* from what is *suspected*.

## Required fields

| Field | Standard |
|---|---|
| **Title** | `[Area] Observable failure in one line` — names the behavior, not the suspected cause. "Checkout total drops the discount" ✅ / "Pricing bug??" ❌ |
| **Severity** | S1 Critical (data loss, security, core flow dead) · S2 High (major flow broken, workaround painful) · S3 Medium (flow works, behavior wrong) · S4 Low (cosmetic, edge) |
| **Priority** | Set at triage, separate from severity. A loud S4 is not an S2. |
| **Environment** | App version/build, URL, browser + version, OS, test data mode, account/role used. "On my machine" is not an environment. |
| **Preconditions** | The exact state before step 1: data seeded, flags, prior actions. |
| **Steps to reproduce** | Numbered, minimal, deterministic. Every step is an action a stranger can perform. If it doesn't reproduce every time, say so and give the rate (e.g., 3/10) plus what varies. |
| **Expected** | What should happen, tied to a requirement, spec, or prior behavior — cite it. "It should work" is not an expectation. |
| **Actual** | What did happen, in observed terms only. |
| **Evidence** | At least one artifact, attached or linked: screenshot/video, Playwright trace, console log, network capture (HAR/request-response), API response body, DB query result. Cross-layer defects attach per-leg evidence: UI / API / DB. |
| **Frequency** | Always / intermittent (rate) / once. |
| **Regression?** | Did this work before? Last known good build, if known. |
| **Related** | Requirement, test case ID, related tickets, related code area — links, not mentions. |
| **Analysis (inference)** | Optional, always labeled **INFERENCE**. Suspected boundary (UI / API / data / config), suspected cause, suggested next probe. Never written as fact. |

## Worked example (abbreviated)

> **Title:** [Cart] Cart total ignores sale price after quantity change
> **Severity:** S2 · **Environment:** Fixture app build 0.1.0, Chromium 141, seeded catalog v3, anonymous user
> **Preconditions:** Product "Blue Hoodie" seeded at $140.00 list / $111.00 sale.
> **Steps:** 1. Add Blue Hoodie to cart. 2. In cart, change quantity 1 → 2. 3. Read the cart total.
> **Expected:** Total = 2 × $111.00 = **$222.00** (sale price governs; catalog rule, seed data v3).
> **Actual:** Total shows **$280.00** (2 × $140.00 list). The sale price is applied on add, then lost on quantity update.
> **Evidence:** Screenshot of cart; API response `GET /cart` returning `unitPrice: 140.00` after the quantity PATCH; DB row showing order line priced at list.
> **Frequency:** Always (5/5). **Regression:** Unknown — first benchmark run against this flow.
> **INFERENCE:** The quantity-update path reprices from list instead of the priced-at-add snapshot. Boundary: API/service layer — the UI faithfully renders what the API returns.

## Lifecycle

1. **New** → filed to this standard.
2. **Triaged** → severity confirmed, priority set, owner assigned.
3. **Fixed** → fix linked (commit/PR).
4. **Verified** → the failing-then-passing check at the lowest level that catches the defect class is linked in the ticket (see Master Test Plan §7). "Works now" in a comment does not verify a defect.
5. **Closed** → or **Reopened** with new evidence, never with "still broken."

## Anti-patterns (sent back on sight)

- No environment, no evidence, or steps that start mid-story ("then it broke").
- Cause stated as fact in the title or Actual field.
- One ticket, three defects.
- Screenshots of an error with no steps and no expected behavior.
- "Intermittent" with no rate and no variance notes.
