# Locator Strategy

How this framework finds elements — and what happens when it can't.

## Priority order

1. **Role + accessible name** (`getByRole`) — survives class renames, mirrors how users and assistive tech see the page.
2. **Test IDs** (`getByTestId`) — the contract with developers; use when the app provides `data-testid`.
3. **Labels and placeholders** (`getByLabel`, `getByPlaceholder`) — form fields.
4. **Text** (`getByText`) — stable user-facing copy only, never dynamic strings.
5. **CSS/XPath** — last resort, and always scoped to a parent locator.

## Self-healing

`src/support/selfHealing.ts` encodes this priority as an ordered fallback chain.
The primary locator is the contract; when it breaks, fallbacks recover the run
only on unambiguous matches (exactly one element) — ambiguous matches are
rejected and logged, never silently healed. Every healing event is logged
(target, failed error, healed-by strategy), and the full attempt log
(`getAttemptLog()`) distinguishes a recovered test from a clean pass.
Healed locators are **proposed fixes, not silent commits** — promoting one to
primary requires a human-approved code change. In `strict` mode, an ambiguous
primary fails fast instead of healing.

See `tests/proof/self-healing.spec.ts` for the executable specification.
