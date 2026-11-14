---
name: verify
description: How to run and drive this app end-to-end to verify a change (dev server, dev sign-in, headless Chrome).
---

# Verifying changes in recipe-app

## Launch

```bash
docker compose -f docker-compose.dev.yml up -d   # Postgres (user/pass/db: recipe)
npm run dev                                       # http://localhost:3000, run in background
```

Wait for `curl -s http://localhost:3000/login` to return 200 (first compile takes ~10s).

Restart the dev server after `npm run db:migrate` — it runs `prisma generate`,
and the running server keeps the old client until it reboots.

**Stop it with `npm run dev:stop`** — nothing else is reliable:

- Stopping the background task (TaskStop) kills `npm`, **not** the
  `next-server (vX)` child, which keeps port 3000. The next `npm run dev` exits
  ("Port 3000 is in use", task reports exit code 1) and you silently test the
  old server. If a dev task exits 1 right after starting, check for this first.
- `pkill -f next-server` / `pgrep -f next-server` **match the shell running
  them** and kill it (exit 144). The script uses `[n]ext-server` to avoid that.

## Smoke suite — run this before committing

```bash
npm run e2e            # all suites, ~1–2 min; needs `npm run dev` up
npm run e2e -- groups  # only suites whose name contains "groups"
```

Lives in `scripts/e2e/` (`lib.mjs` = helpers; one file per suite, registered
in `run.mjs`). Covers family groups and note/recipe sharing, bulk sharing, and
the ingredient editor. Cleans up before and after itself. When a change touches
one of those areas, run it; when you add a feature, add a suite (or extend one)
rather than writing a throwaway script in the scratchpad.

Suite conventions (cleanup depends on them):

- Users come from `seedUser("<role>")` → `e2e-<role>@test.local` with a live
  session, and `pageFor(browser, user)` opens a signed-in, phone-sized page.
  No login form, so the dev sign-in's role upsert can't demote anyone. Use
  `signInViaForm` only when testing what happens *at* sign-in (invites).
- Name recipes, tags and ingredients with an **`E2e` prefix**. Tags and
  ingredients are global rows — they do **not** cascade from the test user, so
  `cleanup()` deletes them by that prefix.
- Assert with `check(condition, message)` (records and keeps going); a thrown
  locator timeout aborts only that suite.

## Sign in (no Google needed)

The `/login` page has a dev-only form (non-production only): fill
`input[name="email"]` (e.g. `dev@local.test`, existing dev user is ADMIN),
optionally `select[name="role"]`, submit. It sets a real `authjs.session-token`
cookie and redirects to `/recipes`.

> **`devSignIn` upserts the role.** Signing in as an existing email with the
> role select set to `USER` **demotes that account**. The select defaults to
> `ADMIN`, so leaving it alone is safe — but always set it explicitly
> (`selectOption('select[name="role"]', "ADMIN")`) when reusing
> `dev@local.test`, and pass `"USER"` deliberately when you want a non-admin
> for a permission test. Signing in as a new address creates that user.

### Faster: seeded users + session cookies for curl

Server actions need a browser, but **read paths don't**. For permission checks,
`npm run seed:test-users` creates owner / member / outsider / admin accounts, a
family group (owner + member), and prints a ready-to-use `curl` line with a
session cookie for each. `npm run seed:test-users -- --clean` removes it all
(so does any `npm run e2e`).

```bash
curl -s -H 'Cookie: authjs.session-token=<printed token>' http://localhost:3000/recipes
```

`jq` is **not installed**; build query strings with
`curl -s -G --data-urlencode "q=süß" <url>` rather than encoding by hand (an
empty `$(...)` silently becomes `?q=`, which returns *everything* and looks
like a pass).

## Drive with a browser

`playwright-core` is a devDependency, driving the system Chrome
(`/usr/bin/google-chrome`, override with `CHROME_PATH`) headless. Prefer the
helpers in `scripts/e2e/lib.mjs` for ad-hoc checks too. Raw sign-in snippet:

```js
await page.goto("http://localhost:3000/login");
await page.fill('input[name="email"]', "dev@local.test");
await page.locator('form:has(input[name="email"]) button').last().click();
await page.waitForURL("**/recipes");
```

## Inspect / seed data

```bash
docker exec recipe-app-db-1 psql -U recipe -d recipe -c '...'
```

Tables: `User`, `Recipe`, `RecipeImage`, `Tag`, `TagName`, `RecipeTag`,
`UserHeartedTag`, `Ingredient`, `Session` (quoted CamelCase). Prefer creating
state through the UI (e.g. heart tags via the buttons on `/tags`,
aria-label "Heart this tag" inside each `li`); clean up seeded rows after.

## Asserting without fooling yourself

Every one of these produced a **false pass or a false failure** in real use.
Assume an assertion is wrong before assuming the app is.

- **Never assert on `page.content()`.** The raw HTML embeds the RSC flight
  payload from the *initial document load*, so a heading from a route you have
  since navigated away from is still in there. Deleting an item and checking
  `content().includes(name)` "fails" forever. Use
  `page.locator("body").innerText()`.
- **`/recipes/new` matches recipe-link greps.** `grep -c 'href="/recipes/'`
  counts the Create button, so an empty result set looks like one hit. Filter
  it out: `grep -o 'href="/recipes/[a-z0-9]*"' | grep -v '/recipes/new"'`.
- **`has-text` is a substring match.** `button:has-text("Add")` also matches
  "Add tags"; `:has-text("Delete")` matches "Delete note". Use
  `getByRole("button", { name: "Add", exact: true })` when labels share a prefix.
- **`grep -c` counts lines, not occurrences** — rendered HTML is often one
  line. Use `grep -o … | wc -l`.
- Expect roughly **2 occurrences per rendered element** when grepping a
  response: once in the HTML, once in the embedded RSC payload. Compare
  presence/absence, not exact counts.
- **Fuzzy search means sentinel values must be far apart.** `zznotealpha` and
  `zznotebeta` match each other, so a "this must not leak" test passes
  vacuously. Use unrelated words (`wolfsbane` / `quicksilver`) on *different*
  recipes so any hit is attributable.
- **A recipe-URL regex also matches `/recipes/new`.**
  `waitForURL(/\/recipes\/[a-z0-9]+$/)` resolves *immediately* on the create
  form, so every later step runs against the wrong page and fails confusingly.
  Use `isRecipePage` from `lib.mjs`, which excludes it.
- **The Next.js dev badge swallows clicks.** The round "N" indicator
  (bottom-left, a `<nextjs-portal>`) covers the batch bar's buttons at phone
  width; the click times out with "nextjs-portal … intercepts pointer events".
  `pageFor` hides it; raw scripts need
  `nextjs-portal { display: none !important }`. Dev-only — not a production bug.
- **`page.reload()` reloads the last URL**, which may be a 404 you visited two
  steps ago. `goto()` the page you actually mean to re-check.
- The navbar renders both a desktop nav (`hidden md:flex`) and a mobile menu;
  `locator(...).first()` often grabs the hidden desktop link — filter by
  visibility or index.
- **Confirm at the database.** When a UI assertion fails, query the DB before
  concluding there's a bug — several "failures" here were correct behaviour
  behind a bad assertion.

## Cleaning up

- This is the user's **live dev DB**, and they create their own data between
  turns. Look at rows before deleting: a stray note or list may be theirs, not
  a leftover fixture. Prefer deleting by the specific ids you seeded.
- Delete test users by email; their sessions, notes, groups and memberships
  cascade. Tags and ingredients they created **don't** (global rows). The
  e2e helpers handle both via the `e2e-` / `E2e` markers — use them.
- `Session` rows accumulate (one per automated sign-in). They expire on their
  own — don't bulk-delete, that would sign the user out of their own browser.
- **Stopping the server:** `npm run dev:stop` (see Launch for why).

## Testing from a phone

`next dev` already binds `0.0.0.0`, so `http://<lan-ip>:3000` works with no
flags. Plain HTTP is fine for `<input capture>` (unlike `getUserMedia`, which
needs a secure context). Auth.js is happy with a non-localhost `Host` in dev.
