# Tutorial — Using the Five-Pillar Framework

A hands-on walkthrough in two parts. **Part 1** takes you from a fresh clone to running every pillar, then walks the framework's flagship workflow line by line. **Part 2** covers the advanced methods: self-healing locators, recon-driven scaffolding, chaos injection, the database lane, evidence discipline, and the proof suite.

Everything runs against the bundled fixture app by default — a small full-stack login app (UI + API + Postgres) that ships with the repo — so every command below works with zero setup beyond the install. Pointing the same specs at your own application is covered at the end of Part 1.

---

## Part 1 — Basic walkthrough

### 1. Install and run your first test

Prerequisites: Node.js 20+ and npm.

```bash
git clone https://github.com/Reed-Timothy-jr/playwright-portfolio.git
cd playwright-portfolio
npm ci
npx playwright install --with-deps chromium
npm run test:e2e
```

`test:e2e` boots the fixture app, runs the login specs, and shuts everything down. You should see both tests pass:

- *valid credentials land in the secure area*
- *invalid credentials show an error, not a silent failure*

Open the HTML report any time with `npm run report`.

### 2. Anatomy of a test

Every spec in this framework follows the same shape. Here is the login spec (`tests/e2e/login.spec.ts`), complete:

```ts
import { expect, test } from '../../src/fixtures';
import { LoginPage } from '../../src/pages/login.page';

test.describe('login e2e', () => {
	test('valid credentials land in the secure area', async ({ page, appTarget }) => {
		const login = new LoginPage(page, appTarget.url);
		await login.login('tomsmith', 'SuperSecretPassword!');
		await expect(login.flash).toContainText('You logged into a secure area!');
	});

	test('invalid credentials show an error, not a silent failure', async ({ page, appTarget }) => {
		const login = new LoginPage(page, appTarget.url);
		await login.login('tomsmith', 'wrong-password');
		await expect(login.flash).toContainText('Your password is invalid!');
	});
});
```

Three things to notice:

- **Specs import `test` from `src/fixtures`, not from Playwright directly.** The fixtures provide the standard context every test needs — `page`, and `appTarget`, which resolves *where* the app under test lives (fixture app or your `BASE_URL`) and what it offers (URL, database handle, whether it is the fixture).
- **Specs never touch selectors.** All element knowledge lives in a page object (`src/pages/login.page.ts`), built on accessible locators first — `getByLabel('Username')`, `getByRole('button', { name: 'Login' })` — with CSS only as a documented last resort. The locator rules are written down in [docs/locator-strategy.md](locator-strategy.md).
- **Assertions state the user-visible contract.** "You logged into a secure area!" is what the user sees; the test asserts exactly that, nothing more internal.

Page objects extend `BasePage`, hold named locator getters, and expose action methods that read like the user story (`login.open()`, `login.login(user, pass)`). When you test your own app, you write new page objects — the spec shape does not change.

### 3. Run every pillar

Each pillar is an independent Playwright project with its own command:

| Pillar | Command | What it proves |
|---|---|---|
| E2E | `npm run test:e2e` | Critical user paths through the UI, including an authenticated project |
| API | `npm run test:api` | Endpoints honor their contracts (status, shape, errors) |
| DB | `npm run test:db` | Data actually persists — verified in the database, not via HTTP |
| Perf | `npm run test:perf` | Key flows stay inside their time budgets (budget enforcement, not load testing) |
| Sec | `npm run test:sec` | Auth behavior and security headers meet the baseline |
| Support (a11y + visual) | `npm run test:support` | Accessibility checks and screenshot regression |
| Everything | `npm run verify` | Lint → typecheck → all of the above, the full local gate |

Run one pillar while developing; run `npm run verify` before you call anything done. That is also the exact sequence CI runs (Part 2, §8).

### 4. Worked example — the flagship workflow

`tests/e2e/flagship.workflow.spec.ts` is the one scenario that demonstrates the whole framework: **API → UI → DB → fault → evidence → cleanup**, in a single test, using `test.step` so the report reads like the story.

1. **API — create data, contract-validated.** A user is created through the API with a unique name; the response is checked for status `201` and parsed against a Zod schema before anything trusts it. The response is attached to the report as evidence.
2. **UI — do something meaningful with the data.** Log in *as the created user* through the real login page and assert the secure-area state — the UI is exercised against data the test owns, not shared seed data.
3. **DB — verify persistence independently.** The database is queried directly (`SELECT id, username FROM fixture_users WHERE username = $1`) and the row must match the API-created id. UI and API can both lie; the stored record is the third witness.
4. **Fault — repeat under chaos.** Cookies are cleared, 1500 ms of latency is injected on the authenticate call, and the login must *still succeed* — and the test verifies the fault actually fired by inspecting the chaos interception log. A resilience claim without proof the fault happened is just a slow test.
5. **Evidence — capture the end state.** A screenshot of the secure area is attached, alongside the JSON evidence from steps 1, 3, and 4.
6. **Cleanup — in `finally`, not at the end.** The created user is deleted via the API and the deletion is verified in the DB. Cleanup lives in a `finally` block so a mid-test failure cannot leak records. The spec is parallel-safe: every record it creates is uniquely named and owned by that test.

That six-beat shape — create through the API, act through the UI, verify in the DB, stress it, evidence it, clean it up — is the pattern to copy for your own flagship flows.

### 5. Point it at your own app

Set `BASE_URL` and the same specs run against your application instead of the fixture app:

```bash
BASE_URL=https://your-app.example npm run test:e2e
```

What transfers unchanged: the fixtures, the gate sequence, evidence capture, the report. What you replace: page objects (your selectors) and API paths. Fixture-only specs (like the flagship, which needs the fixture database) skip themselves cleanly when the target is not the fixture app — they never fail misleadingly against the wrong target.

---

## Part 2 — Advanced methods

### 1. Self-healing locators — strict by default, healing is a logged event

Locators in this framework resolve **strictly**: if a locator fails, the test fails. Healing is an explicit opt-in per locator, via `SelfHealingLocator` / the `heal()` helper in `src/support/selfHealing.ts`. When an opted-in locator fails, the healer tries fallback strategies and — this is the design rule — **every attempt is recorded** as a healing event: the locator, the strategy tried, the outcome. Nothing is silently repaired; a heal shows up in the evidence so a drifting UI is visible as maintenance signal, not hidden by it. `tests/proof/self-healing.spec.ts` proves the behavior: break a locator on purpose and the framework must heal it *and* produce the event log. Use healing for resilience on stable-but-evolving apps; never as a substitute for fixing a bad locator.

### 2. Recon → scaffold: generate the starting point, review it, promote it

For an application you have no tests for yet:

```bash
npm run recon -- --url https://your-app.example   # writes app-model.json
npm run scaffold -- --model app-model.json        # writes generated/
```

The recon crawler walks the app **read-only and same-origin only**, and emits a Zod-validated application model: routes, forms, interactive elements. The scaffold generator turns that model into draft page objects and smoke specs under `generated/`. The rule is **scaffolds, not suites**: generated code is a reviewed starting point you promote into `src/pages/` and `tests/` after reading it — never a finished suite you ship unread. Full details in [docs/recon.md](recon.md).

### 3. Chaos and fault injection

The `chaos` fixture wraps `ChaosInjector` (`src/support/chaos.ts`): start a fault scoped to a URL pattern — latency, error responses — run the flow, assert the recovery, then inspect `chaos.getInterceptions()` to prove which requests the fault touched. The flagship workflow (§4) is the canonical example. Keep faults bounded and always stopped in a `finally`; a fault left running poisons every later assertion in the worker.

### 4. The database lane — PGlite by default, real Postgres when it matters

DB specs run against **PGlite** (in-process Postgres) by default: a real SQL engine with zero infrastructure, so the DB pillar works in any sandbox or CI container. The same specs can run against a real PostgreSQL instance when the target environment demands it — the query layer (`src/support/db.ts`) is identical either way, parameterized queries throughout. Treat the DB pillar as independent verification: its job is to catch the cases where the API returns success and nothing was stored.

### 5. Evidence discipline and the flakiness report

Evidence helpers (`src/support/evidence.ts`) attach JSON and screenshots to the report so a failure carries its own context: what the API returned, what the DB held, what the user saw. Playwright traces and video are captured on failure via the config. After a run, `npm run report:flakiness` breaks down **first-attempt vs retry** results — retries that quietly pass are how suites rot, and this report exists to make that visible instead of comfortable.

### 6. The proof suite — detection is a tested behavior

```bash
npm run test:proof
```

The proof project (`tests/proof/`) plants realistic defects — a broken locator, an injected fault, a contract violation — and asserts the framework *catches* them (the kill matrix: every planted mutant must turn the right pillar red). A framework that has never been observed failing correctly is an assumption, not a safety net. Run the proof suite after changing anything in `src/support/`. The expected outcomes are specified in [docs/expected-outcomes.md](expected-outcomes.md).

### 7. Accessibility auditing, standalone

Beyond the a11y project in the suite, the audit module runs against any URL:

```bash
npm run audit:a11y -- --url https://your-app.example
```

It audits the four areas from [docs/accessibility.md](accessibility.md) — alt text, keyboard navigation, color contrast (WCAG 2.1 AA), and form labels — and reports findings with severities, suitable as a client-facing deliverable or a CI gate.

### 8. CI on any platform — one gate contract

The repo ships the same pipeline for the five major DevOps platforms (see the README's DevTestOps matrix): GitHub Actions (live), GitLab CI, Azure Pipelines, Jenkins, and CircleCI. Every implementation runs the identical contract — install → lint → typecheck → `test:all` → dependency audit → flakiness report → published evidence — so a red build means the same thing everywhere. For large suites, shard with Playwright's `--shard` across parallel jobs on any of these platforms; the specs are parallel-safe by construction (each owns its data, §4).

### 9. Auth once, reuse everywhere

`tests/auth.setup.ts` runs as the `setup` project: it authenticates once and saves the storage state, and the `e2e-auth` project depends on it and starts already logged in (`tests/e2e/secure-area.auth.spec.ts`). Never re-login per test — authenticate in setup, keep credentials in environment/CI secrets, and let specs begin at the workflow they actually test.

---

## Where to go next

- [Master Test Plan](master-test-plan.md) — the gates and evidence rules this tutorial operates under.
- [Automation Testing — The 5-Star Standard](automation-testing-5-star.md) — what "good" looks like per pillar.
- [Locator Strategy](locator-strategy.md) — the full locator rules behind §2.
- [Recon](recon.md) — the crawler and scaffold generator in depth.
- [Accessibility](accessibility.md) — the audit module's standard.
- [What's Next](whats-next.md) — the honest gap list.
