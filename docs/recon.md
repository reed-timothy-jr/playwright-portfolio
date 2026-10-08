# Recon — point the framework at any app

Recon is the loop that turns "an application" into "a starting test suite":

```
npm run recon -- --url <app>      →  app-model.json   (crawl, read-only)
npm run scaffold -- --model app-model.json           (page objects + smoke specs)
# review generated/, promote the keepers, delete the rest
```

## 1. Crawl (`npm run recon`)

`scripts/recon.ts` launches Chromium, breadth-first crawls the target
(same-origin only, bounded by `--max-pages` / `--max-depth`), and writes a
versioned, Zod-validated `AppModel`:

- pages: URL, path, title, HTTP status
- forms: action, method, fields (name, type, label, required), guessed purpose
  (`login` / `search` / `register` / `unknown`)
- API endpoints observed as XHR/fetch traffic (numeric and UUID path
  segments normalized to `:id`, e.g. `/api/users/:id`)
- console-error counts per page

Rules the crawler follows:

- **Read-only.** It clicks nothing and submits nothing. Describing a form
  is not testing it — that decision belongs to the engineer reviewing the
  scaffolds.
- **Same-origin by default.** It never follows the app out onto the open
  web. `--include-subdomains` covers SSO-style flows that legitimately hop
  hosts.
- **Bounded.** Every crawl has a page and depth cap. An unbounded crawl
  against a large app is a self-inflicted DoS.
- **Caller-owned auth.** Pass `--auth-state <storageState.json>` (the file
  `tests/auth.setup.ts` produces) to crawl behind login.

Check the model file in. Generated tests are only as deterministic as the
model they came from, and a diffed `app-model.json` is honest evidence of
what the app looked like when scaffolds were created.

## 2. Scaffold (`npm run scaffold`)

`scripts/scaffold.ts` reads the model and writes:

- `src/pages/generated/<page>.page.ts` — page object with `goto()`,
  `expectLoaded()`, and locator getters (accessible label first, then
  `[name=]`, never XPath-by-position)
- `tests/e2e/generated/<page>.smoke.spec.ts` — per-page smoke: loads with
  the recorded status, asserts title, fails on console errors

Only HTTP-200 HTML pages are scaffolded; API routes and error pages are
skipped. Files are stamped `GENERATED` and existing files are never
overwritten unless `--force` is passed.

## 3. Review (the human step)

The generator scaffolds; it does not author. The workflow is:

1. Read what was generated.
2. Rename and move the keepers out of `generated/` into the real suites.
3. Harden the locators that matter (the self-healing layer covers the rest).
4. Delete everything else.

See `docs/adr-003-recon-scaffolds.md` for why the framework refuses to
generate finished suites.

## 4. Feeding the framework beyond scaffolds

The `AppModel` is plain JSON, so it feeds more than the generator:

- **API pillar**: observed endpoints seed the typed `ApiClient` paths and
  Zod contract schemas.
- **Security pillar**: the endpoint inventory is an attack-surface list for
  auth-rejection and header checks.
- **AI test authoring (future)**: the model is grounded app context — page
  inventory, forms, and endpoints — for an LLM to propose tests from,
  instead of hallucinating them from a blank prompt.
