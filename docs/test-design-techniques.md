# Test Design Techniques — The ISTQB Map

The framework's specs were not written by wandering around the app. Each one exists because a named test design technique produced it. This page maps the ISTQB (CTFL v4.0, Chapter 4) black-box techniques to the running tests in this repo — so a reviewer can trace **technique → test basis → spec** instead of taking coverage on faith.

Terminology follows the ISTQB glossary; see [istqb-glossary.md](istqb-glossary.md).

## Equivalence partitioning (EP)

**Idea:** divide inputs into partitions where every value should behave the same; test one representative per partition.

| Partition set | Partitions | Where it runs |
|---|---|---|
| Login credentials | known user + correct password · known user + wrong password · unknown user | `tests/e2e/login.spec.ts`, extended to all rules in the decision-table spec below |
| Create-user payloads | valid payload · duplicate username (409 class) · malformed payload (400 class) · missing user on read/delete (404 class) | `tests/api/users.spec.ts` — one test per class, each asserting its class's status **and** error contract |

The API suite is EP discipline made visible: every test names the class it represents, and no two tests spend effort inside the same partition without a reason (a boundary — next technique).

## Boundary value analysis (BVA)

**Idea:** defects cluster at partition edges; test the boundary and its neighbors. ISTQB convention: **2-value BVA** tests the boundary and the nearest invalid value; **3-value** adds the nearest valid neighbor.

The fixture API has two length rules, verified from source: username ≥ 3 characters, password ≥ 8 characters.

| Rule | 2-value set | 3-value set (what runs) | Spec |
|---|---|---|---|
| Username length ≥ 3 | {2, 3} | {2, 3, 4} | `tests/api/users.bva.spec.ts` |
| Password length ≥ 8 | {7, 8} | {7, 8, 9} | `tests/api/users.bva.spec.ts` |

Why this is more than technique points: the proof suite's `weak-password` mutant disables the password-length rule. Under that mutant the 7-character row stops returning 400 — **the BVA spec is the test that kills that mutant.** Boundary rows are cheap; the class of defect they catch (off-by-one, dropped validation) is not.

## Decision table testing

**Idea:** when outcomes depend on *combinations* of conditions, enumerate the rules and execute every feasible one.

Login has two conditions (username known? password correct?) and three outcomes — four rules, all implemented in `tests/e2e/login.decision-table.spec.ts`:

| Rule | Username known | Password correct | Outcome |
|---|---|---|---|
| R1 | yes | yes | Secure area |
| R2 | yes | no | "Your password is invalid!" |
| R3 | no | yes (well-formed) | "Your username is invalid!" |
| R4 | no | no | "Your username is invalid!" |

R4 is the row teams skip, and the most valuable one: it proves evaluation order — an unknown user gets the username message regardless of password — which is also the anti-enumeration behavior. A future refactor that "helpfully" distinguishes the checks would flip R4 and fail this suite before it shipped an account-existence leak.

## State transition testing

**Idea:** model the system as states and transitions; test valid transitions and what invalid ones do.

The authenticated area is a three-state machine — *anonymous → authenticated → logged out* — covered in `tests/e2e/secure-area.auth.spec.ts`:

- Valid transition: login moves anonymous → authenticated; the secure area loads with the saved session.
- Valid transition: logout moves authenticated → anonymous, and the test then proves the state is real: `/secure` bounces back to `/login`.
- Invalid transition: requesting `/secure` while anonymous never renders protected content — it redirects to login (also exercised by the auth setup project design).

## Pairwise testing — documented, honestly scoped

**Idea:** most defects are triggered by pairs of parameter values, so test all pairs instead of the full factorial.

The framework's own combinatorial surface is the platform matrix (browser × device profile × project, from the multi-platform CI design). The full cross-product is wasteful; the working rule here is: **Chromium runs everything on every change; Firefox and WebKit run the pillar suites on merge; device profiles run the e2e pillar** — a risk-selected reduction of the matrix, documented as such rather than dressed up as a pairwise-generated suite. A generated pairwise spec is on the [what's-next list](whats-next.md); this page does not claim it exists.

## Error guessing and experience-based testing

**Idea:** testers attack where systems have failed before. In this framework the attack knowledge is codified, not left in someone's head: the **chaos pillar work** (latency and fault injection with recovery assertions, in the flagship workflow and `tests/proof/chaos.spec.ts`) and the **kill matrix** (`tests/proof/`) are error guessing turned into permanent regression assets. A defect found by exploration graduates into a spec or a mutant — see the defect standard in [master-bug-ticket.md](master-bug-ticket.md) and the manual discipline in [manual-testing-5-star.md](manual-testing-5-star.md).

## The traceability rule

Every technique above names its test basis (the rules, partitions, or states it derives from) inside the spec file's header comment. If a spec cannot say which technique produced it and what basis it covers, it does not merge. Coverage claims in this repo are traceable to a technique and a file — that is the ISTQB point, and it is enforceable in review.
