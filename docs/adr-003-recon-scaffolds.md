# ADR-003: Recon generates scaffolds, not suites

Date: 2026-10-08
Status: accepted

## Context

The recon crawler can describe any application's pages, forms, and API
endpoints. The tempting next step is "generate the whole test suite."
We are not doing that.

## Decision

`npm run scaffold` produces **scaffolds** — page objects and smoke specs
under `generated/` directories, clearly stamped, never overwriting human
code — and stops there. The engineer reviews, promotes, and deletes.

## Rationale

1. **A generated suite nobody read is a liability, not coverage.**
   Auto-generated assertions encode the app's current behavior as truth,
   including its bugs. A human must decide which behaviors are contracts
   worth pinning.

2. **Consistent with the healing philosophy** (see `src/support/selfHealing.ts`
   and `docs/locator-strategy.md`). The framework
   never silently rewrites the suite: healing produces a reviewable event
   log, and scaffolding produces reviewable files. Generation without
   review would be the same sin at a larger scale.

3. **Generated code rots on contact with real apps.** Locators need
   human judgment (which element is the *contract*?), and test data needs
   isolation strategy. Scaffolds get the engineer to a running start in
   minutes; the last mile is where the value — and the judgment — lives.

4. **Determinism.** The AppModel is checked in as a fixture, so scaffolds
   are reproducible from a known snapshot. Live re-generation on every CI
   run would couple the suite to the app's current deploy.

## Consequences

- `generated/` directories are gitignored by convention in consuming
  projects; promoted files live with the hand-written suites.
- A future AI authoring layer consumes the AppModel as grounded context
  and *proposes* tests as diffs — same rule, larger vocabulary.
