# Manual Testing — The 5-Star Standard

*Owner: Timothy Reed Jr. — Lead QA / SDET. Companion to the Master Test Plan: automation verifies at scale, but manual testing is where new risk is discovered. This document is the quality bar for that work — what "five-star" manual testing looks like on any team I lead.*

## Why a standard for manual testing

Automated suites answer "did it break?" They cannot answer "what haven't we thought of?" Manual testing is the discovery discipline — and undisciplined discovery is just clicking around. Five stars, five disciplines. A manual cycle that misses a star is not finished, whatever the calendar says.

## ⭐ Star 1 — Charters before clicks

Every manual session starts from a written **charter**: a mission, a bounded area, and a timebox.

> *Explore the checkout flow with invalid and boundary payment data, hunting for totals that disagree between cart, API, and confirmation. Timebox: 90 minutes.*

- Charters derive from requirements, recent changes, defect history, and risk — in that order.
- No charter, no session. "Test the app" is not a charter.
- Charters are listed in the cycle plan before execution begins, so coverage is a decision, not an accident.

## ⭐ Star 2 — Coverage you can defend

- Every requirement and every user workflow maps to at least one charter or case; the mapping is a document, not a memory.
- Risk-weighted: money movement, auth, data loss, and security boundaries get depth; cosmetic surfaces get breadth.
- Negative and boundary paths are chartered explicitly — happy-path-only manual testing is a demo, not a test cycle.
- Accessibility spot-checks (keyboard path, focus order, labels) ride along on workflow charters, not as an afterthought cycle.

## ⭐ Star 3 — Disciplined execution

- Session-based: work in timeboxed sessions (60–120 min), one charter per session, notes taken *during* the session — tours, data used, paths taken, questions raised.
- Test data is created deliberately (boundary values, hostile strings, empty/maximum states), never whatever happens to be in the environment.
- When something smells wrong mid-session, the session follows it — and the deviation is written into the session notes. Discoveries off-charter are the point of manual testing; undocumented discoveries are lost value.
- Blocked is a status, not a mood: a blocked charter names what blocks it and who can unblock it, the same day.

## ⭐ Star 4 — Defects at the Master Bug Ticket standard

- Every defect found manually is filed on the **Master Bug Ticket** format (`docs/master-bug-ticket.md`) — environment, deterministic steps, expected vs actual, evidence attached.
- Manual testing's superpower is evidence a script can't improvise: screen recordings of timing/race behavior, photos of physical-device issues, exact gesture sequences. Capture them in the moment; they cannot be recreated later.
- A manual defect that "can't be reproduced" gets its reproduction rate and variance notes, not a shrug (see the bug ticket standard).

## ⭐ Star 5 — Findings become assets

A manual cycle that ends in a meeting was wasted. It ends in assets:

- **Session reports**: charters run, coverage achieved, defects filed, risks remaining — one page, written the same day.
- **Automation candidates**: every manual defect and every high-value charter is triaged for the automated suite. The rule from the Master Test Plan applies: a defect closes with a failing-then-passing automated check at the lowest level that catches it. Manual finds it once; automation guards it forever.
- **Sign-off is explicit**: the cycle closes with a written verdict — ship / ship with known risks (listed) / do not ship (blockers listed). No verbal sign-offs, no implied sign-offs.

## The 5-star checklist (per cycle)

- [ ] Charters written and risk-ordered before execution
- [ ] Requirement/workflow → charter mapping attached to the cycle plan
- [ ] All sessions timeboxed, notes filed same-day
- [ ] All defects on the Master Bug Ticket standard, evidence attached
- [ ] Session report published; automation candidates triaged
- [ ] Written sign-off verdict issued

## How this connects to the framework

The five pillars catch regressions deterministically; this standard governs the human discovery that finds what the pillars should catch next. Recon feeds it (the crawler's app model is the charter-writing map for a new surface), and its output feeds the pillars (automation candidates). Manual and automated testing are one system here — this document is the manual half of it.
