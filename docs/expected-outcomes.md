# Expected Outcomes — Defect-Detection Proof Suite

`tests/proof/defect-detection.spec.ts` plants realistic defects and asserts
the framework **detects** them. The specs pass green *because* detection
worked — a red run here means the framework went blind, which is the
scariest failure a test framework can have.

Run with `npm run test:proof`. These are evidence, not regression coverage
(they are intentionally excluded from `test:all`).

| # | Scenario | Planted defect | Detection mechanism | Expected result | Failure artifact |
|---|----------|----------------|---------------------|-----------------|------------------|
| (a) | Ambiguous UI change | Deploy duplicates a button — two identical "Delete" buttons; the primary locator is stale | `SelfHealingLocator` — a fallback matching ≠1 element is rejected, never healed | `resolve()` rejects; audit log shows `ambiguous-rejected` with "matched 2 elements"; zero healing events | `ambiguity-audit` JSON attachment (rejection message + attempt log) |
| (b) | API contract break | Backend drops the `email` field; status stays 200 | Zod `safeParse` on the response contract | `parsed.success === false` despite HTTP 200 | `contract-violation` JSON attachment (status + offending payload) |
| (c) | False-positive UI | Duplicate create → 409, but a sloppy `status < 500` check calls it success | Independent DB verification (`verifyPersisted` pattern) | Sloppy check says success AND row count proves nothing persisted → mismatch exposed; owned record cleaned up | `false-positive-check` JSON attachment (status, sloppy verdict, actual row count) |

## Reading a red run

- **(a) red** → the healer resolved an ambiguous match (clicked the wrong
  thing and passed) or threw the wrong error. Check the attempt log first.
- **(b) red** → the schema accepted a broken payload. The contract is too
  loose — tighten the Zod schema (`.strict()`, required fields).
- **(c) red** → either the control case failed (fixture API/DB broken) or
  the duplicate actually persisted (uniqueness constraint missing).
