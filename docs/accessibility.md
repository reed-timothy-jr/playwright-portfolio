# Accessibility Audit Module

The a11y supporting suite grew from a single axe scan of the login page
into a reusable audit module — `src/support/a11y.ts` — plus a standalone
CLI, `scripts/a11y-audit.ts`. It productizes the review prompt:

> "Audit my web app for accessibility. Check alt text, keyboard
> navigation, color contrast, and form labels. Fix every issue you find."

The module finds and reports; the "fix" step stays with the developer —
every finding ships with a plain-language fix instruction so the loop is
short.

## Benchmark

**WCAG 2.1 AA**, via axe-core tags `wcag2a`, `wcag2aa`, `wcag21a`,
`wcag21aa` — the same tag set the original demo spec used.

## What it checks

### Full axe scan (`auditAccessibility` / `runAxeScan`)

One axe-core pass over the page. Every violation is normalized to
`{ id, impact, help, helpUrl, area, nodes[] }` with the node selector,
HTML snippet, and (for contrast) the measured ratio data attached.

### 1. Alt text (`checkAltText`)

- Axe rules: `image-alt`, `input-image-alt`, `area-alt`, `object-alt`,
  `role-img-alt`, `svg-img-alt`.
- A DOM inventory of every `img`, `input[type="image"]`, `svg[role="img"]`,
  and `[role="img"]` element and whether it exposes an accessible name.
  Elements marked decorative (`alt=""`, `aria-hidden`, presentation
  roles) are inventoried but not flagged.

### 2. Keyboard navigation (`checkKeyboardNavigation`)

A programmatic Tab-walk: the checker presses Tab up to N stops
(default 50) and records the focus order — selector, tag, role, text —
for every stop. It flags:

- **Clickable but not focusable** — elements with an inline `onclick`,
  an interactive ARIA role, or `cursor: pointer` styling that are not in
  the tab order. (Heuristic: click handlers registered via
  `addEventListener` and framework event systems are not visible to a
  DOM scan, so this list is a floor, not a census.)
- **Invisible focus** — a stop whose computed style shows no outline and
  no box-shadow substitute while focused. (Heuristic: sites that signal
  focus by changing background, border, or text decoration instead will
  be misread — verify flagged stops by hand before filing them.)
- **Main content never reached** — the walked tab order never enters a
  `<main>`, `[role="main"]`, or `<form>` region.

### 3. Color contrast (`checkColorContrast`)

Axe's `color-contrast` / `color-contrast-enhanced` rules, with the
measured data surfaced per node: ratio, foreground, background, font
size/weight, and the expected ratio. Note axe can only evaluate text
whose effective background it can resolve — text over images or
gradients lands in axe's "incomplete" bucket and needs a manual check.

### 4. Form labels (`checkFormLabels`)

- Axe rules: `label`, `label-title-only`, `select-name`,
  `input-button-name`, `button-name`, `form-field-multiple-labels`.
- A DOM inventory of every `input` / `select` / `textarea` / `button`
  (excluding `type="hidden"`) and the source of its accessible name:
  associated `<label>`, `aria-label`, `aria-labelledby`, `title`, text
  content (buttons), or `value` (submit/button inputs). Controls with no
  name from any source are flagged with their selectors.

## Running it

### The specs (fixture app by default)

```bash
npx playwright test --project=a11y
# or, with the visual suite:
npm run test:support
```

`tests/a11y/login.a11y.spec.ts` is the original single-scan demo.
`tests/a11y/full.a11y.spec.ts` exercises the module end to end: full
audits of `/login` and `/secure` (after the login flow), the keyboard
tab-order reaching username/password/submit, and the form-label
inventory.

### The CLI (any URL)

```bash
npm run audit:a11y -- --url https://your-app.example \
  --out report.md --json report.json
```

- `--url` is repeatable or comma-separated; a multi-route audit
  produces one report with a section per URL, including the final URL
  and HTTP status actually observed for each route.
- `--max-tabs N` caps the keyboard walk (default 50).
- `--ignore-https-errors` is opt-in for targets behind TLS-inspecting
  proxies or self-signed staging certs. Leave it off for production —
  a certificate error is itself a finding.
- The report (`formatA11yReport`) leads with summary counts by impact
  and by area, then per-area sections listing rule id, help text, node
  selector + HTML snippet, and a per-rule "how to fix" line.

In code:

```ts
import { auditAccessibility, blockers, formatA11yReport } from './src/support/a11y';

const audit = await auditAccessibility(page);
const gate = blockers(audit.violations); // critical + serious
```

## The severity gate in CI

The framework's bar, consistent across the a11y suite: **critical and
serious findings are blockers; moderate and minor findings are reported
but do not fail the build.** Two ways to enforce it:

- **Specs:** assert `expect(blockers(audit.violations)).toEqual([])`.
- **CLI:** the process exits `1` when any audited page has a blocker
  node, `0` otherwise — so `npm run audit:a11y -- --url …` can be a CI
  step as-is.

Tighten or loosen per team: filter on a different impact set, or assert
zero violations of any impact for a stricter bar. Whatever you choose,
write it down — an undocumented gate gets argued with at the worst time.

## Honest limits

Automated tooling checks only part of WCAG — common estimates put
machine-detectable issues at roughly a third to a half of the success
criteria. This module cannot judge whether alt text is *good*, whether
focus order is *logical* beyond reachability, how a screen reader
actually announces a flow, or anything about cognitive accessibility.
Pair it with manual keyboard walkthroughs and assistive-technology
passes before making claims about a product.

**This module and its reports are engineering tooling, not legal
advice and not a compliance certification.** If your product has legal
accessibility obligations (ADA, Section 508, EAA, …), have qualified
counsel and accessibility specialists assess it.
