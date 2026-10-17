# ISTQB Glossary — The Terms This Repo Uses

Short, plain-language definitions of the ISTQB terms that appear across this repository's documents and specs, each with a pointer to where the concept lives here. Definitions are paraphrases for working use — the authoritative source is the official ISTQB Glossary. Aligned to CTFL v4.0 and CTAL-TAE v2.0 usage.

## Core distinctions

- **Error** — a human action that produces an incorrect result (the typo in the code). *Repo:* not directly observable; never the word a defect report uses for what was seen.
- **Defect (fault/bug)** — an imperfection in a work product that can cause a failure. *Repo:* filed to the [Master Bug Ticket](master-bug-ticket.md) standard.
- **Failure** — the observable event: the system deviates from expected behavior. *Repo:* what evidence capture records — screenshots, traces, responses.
- **Root cause** — the earliest point in the chain that, if removed, prevents the defect class. *Repo:* belongs in failure analysis, labeled as inference until proven.

## Test design

- **Test basis** — the body of knowledge a test derives from (requirements, rules, code behavior). *Repo:* named in every technique spec's header — see [test-design-techniques.md](test-design-techniques.md).
- **Test condition** — a testable aspect of the basis ("passwords under 8 characters are rejected"). *Repo:* BVA rows and decision-table rules are conditions made executable.
- **Test case** — inputs, preconditions, and expected results for a condition. *Repo:* the specs themselves.
- **Test oracle** — the source used to determine the expected result. *Repo:* the fixture app's documented behavior and the API contracts; where no oracle exists, the test does not get written until one does.
- **Equivalence partitioning** — grouping inputs that should behave identically and testing one per group. *Repo:* API status classes (201/400/404/409).
- **Boundary value analysis** — testing partition edges (2-value: boundary + invalid neighbor; 3-value: + valid neighbor). *Repo:* `users.bva.spec.ts` — {2,3,4} and {7,8,9}.
- **Decision table** — the enumeration of condition combinations and their outcomes. *Repo:* `login.decision-table.spec.ts`, rules R1–R4.
- **State transition testing** — verifying valid and invalid moves between system states. *Repo:* the anonymous/authenticated/logged-out session specs.
- **Pairwise testing** — covering all value *pairs* across parameters instead of the full cross-product. *Repo:* the documented CI matrix reduction; see the techniques page for the honest scope note.
- **Coverage** — the degree to which specified items (partitions, boundaries, rules, states) were exercised. *Repo:* claims are always tied to a technique and a file — never a bare percentage.

## Process and management

- **Entry / exit criteria** — conditions to start, and to declare done. *Repo:* the [Master Test Plan](master-test-plan.md) gates; exit evaluation in the [test summary report](test-summary-report.md).
- **Test summary (completion) report** — the closing record of a test cycle: scope, results, defects, recommendation. *Repo:* [test-summary-report.md](test-summary-report.md) template.
- **Risk-based testing** — prioritizing by product risk (likelihood × impact). *Repo:* [risk-based-testing.md](risk-based-testing.md).
- **Product risk vs project risk** — risk in the *thing built* vs risk in the *work of building/testing it*. *Repo:* the register covers product risks; framework risks (e.g., locator rot) are marked as such (R11).
- **Severity** — how bad a defect's impact is. **Priority** — how urgently it should be fixed. Different axes; the bug ticket standard records both, separately.
- **Regression testing** — re-running tests to confirm unchanged behavior stayed unchanged. *Repo:* the pillar suites under CI; flakiness discipline keeps regression signal trustworthy.
- **Defect management** — the lifecycle of recording, triaging, fixing, and verifying defects. *Repo:* process standard in the Master Bug Ticket; defects found by exploration graduate into specs or proof-suite mutants.

## Automation (CTAL-TAE)

- **Test Automation Solution (TAS)** — the whole automation system: framework, suites, tooling, processes. *Repo:* this repository, end to end.
- **Generic Test Automation Architecture (gTA)** — the ISTQB reference layering: generation, definition, execution, adaptation. *Repo:* mapped layer-by-layer in [test-automation-architecture.md](test-automation-architecture.md).
- **Testware** — the artifacts testing produces and maintains: specs, page objects, data, docs. *Repo:* everything under `tests/`, `src/`, `docs/`.
- **Test charter** — a short mission statement for an exploratory session: what to explore, with what, looking for what. *Repo:* the manual discipline in [manual-testing-5-star.md](manual-testing-5-star.md).
- **Session-based testing** — exploratory testing run as uninterrupted, time-boxed, debriefed sessions against charters. *Repo:* same manual standard; findings feed automation via the defect standard.
