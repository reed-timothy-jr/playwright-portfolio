# Test Summary Report — Template (ISTQB-Aligned)

The report that closes a test cycle: what was tested, what the evidence says, and whether the exit criteria in the [Master Test Plan](master-test-plan.md) are met. Aligned to the ISTQB test completion reporting practice (CTFL v4.0 Ch. 5) and fed entirely by outputs this framework actually produces — pillar results, the flakiness report, healing events, and defect records written to the [Master Bug Ticket](master-bug-ticket.md) standard.

Copy this file per release/cycle and fill it in. Every field names its source; a field with no source does not get filled with adjectives.

---

## 1. Identification

- **Product / release:** _name + version/commit_
- **Test period:** _start – end dates_
- **Environment(s):** _fixture / staging URL, browser matrix executed_
- **Report author / date:** _name, date_

## 2. Scope summary

- **In scope this cycle:** _features, pillars, risk items (link [risk-based-testing.md](risk-based-testing.md) rows)_
- **Out of scope / not tested:** _explicit list + reason — an empty field here is a red flag, not a comfort_
- **Deviations from the test plan:** _what changed vs [master-test-plan.md](master-test-plan.md), and who approved it_

## 3. Results by pillar

_Source: the run's unified report / CI artifacts._

| Pillar | Executed | Passed | Failed | Blocked/Skipped | Notes |
|---|---|---|---|---|---|
| E2E | | | | | |
| API | | | | | |
| DB | | | | | |
| Perf (budgets) | | | | | |
| Sec | | | | | |
| A11y / Visual | | | | | |
| Proof suite | | | | | _planted defects killed: n / n_ |

## 4. Quality signals

- **Flakiness:** _first-attempt pass rate vs post-retry rate (source: `npm run report:flakiness`) — list any test that passed only on retry; a retry-masked failure is reported here, never silently absorbed_
- **Self-healing events:** _count + locators healed (source: healing event logs) — repeated healing on one locator is a product-instability signal; name it_
- **Performance budgets:** _flows inside budget / breaches with values_
- **Proof suite:** _which mutants survived, if any — a surviving mutant is a finding about the framework, filed like any defect_

## 5. Defects

_Source: defect records per [master-bug-ticket.md](master-bug-ticket.md). Observed facts only in this summary; inference stays in the tickets, labeled._

| Severity | Opened | Closed | Open at report | Blocking release? |
|---|---|---|---|---|
| Critical | | | | |
| Major | | | | |
| Minor | | | | |

- **Open critical/major defects:** _IDs + one-line observed impact each_

## 6. Coverage statement

- **Requirements / risks covered:** _traceability — which plan items and risk-register rows the executed suites cover (technique traceability per [test-design-techniques.md](test-design-techniques.md))_
- **Known coverage gaps:** _untested areas and the residual risk of each — stated plainly_

## 7. Exit criteria evaluation

_Per the Master Test Plan's exit gates. Each gate: MET / NOT MET + evidence link._

- [ ] All critical-path pillar suites executed on the release build
- [ ] No open critical defects; majors triaged with recorded decisions
- [ ] Proof suite fully green (all planted defects killed)
- [ ] Flakiness within threshold; no unexplained retry passes
- [ ] Performance budgets met or breaches accepted in writing
- [ ] Evidence bundle published (report + traces + attachments) at a durable URL

## 8. Recommendation

_One of: RELEASE / RELEASE WITH KNOWN RISKS (name them) / DO NOT RELEASE (name the blocking evidence). Signed by the QA lead with the date. A recommendation without the evidence above it is an opinion; this document exists so it never has to be._
