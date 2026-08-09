# CLAUDE.md

Guidance for working in this repository. See `PLAN.md` for the full product
spec and `README.md` for setup instructions.

## What this is

A self-hosted, mobile-first web app for managing, sharing, and viewing recipes.
Google-only auth, deployed via Docker on a home server.

## Commands

```bash
npm run dev          # dev server (http://localhost:3000)
npm run build        # prisma generate + next build (also the typecheck gate)
npm run lint         # eslint
npm run db:migrate   # create + apply a dev migration (needs the db up)
npm run db:studio    # browse data
docker compose -f docker-compose.dev.yml up -d   # local Postgres for dev
```

Deployment: `docker-compose.yml` is the **production** stack (pulls the GHCR
image, port 3100, appdata bind-mounts) — see `DEPLOY.md`. Don't use it for local
dev; use `docker-compose.dev.yml` + `npm run dev`. The app image is built/pushed
by `.github/workflows/docker-publish.yml`. Secrets (Google, `AUTH_SECRET`) are
read at runtime from `.env`, never baked in. `AUTH_ALLOWED_EMAILS` (optional,
comma-separated) restricts who may sign in via Google.

After changing `prisma/schema.prisma`, run `npm run db:migrate` and commit the
generated migration under `prisma/migrations/`. `db:migrate` also runs
`prisma generate`, so **restart `npm run dev`** afterwards or it keeps the old
client.

For SQL Prisma can't express (extensions, functional indexes), use
`npx prisma migrate dev --create-only --name x`, hand-edit the generated
`migration.sql`, then apply with `npm run db:migrate`. Rewriting a migration
that has **already been applied** breaks its checksum — fix with
`DELETE FROM _prisma_migrations WHERE migration_name = '…'` followed by
`npx prisma migrate resolve --applied <name>`, and only ever on a migration
that hasn't left this machine.

## Stack & deliberate version choices

- **Next.js 16** (App Router, Turbopack) + **React 19** + **TypeScript**.
- **Tailwind v4** (CSS-first config in `src/app/globals.css`; no `tailwind.config`).
  shadcn/ui is configured (`components.json`, `new-york`, neutral) — add
  components with `npx shadcn@latest add <name>`.
- **Prisma 6** — pinned deliberately. Prisma 7 dropped `url` from the schema and
  requires a `prisma.config.ts` + driver adapter; we stay on 6 for the classic
  `url = env("DATABASE_URL")` setup. **Do not bump to 7 without migrating that.**
- **Auth.js / NextAuth v5 (beta)** — Google provider, **database** sessions.
- **ESLint flat config** importing `eslint-config-next` directly. `next lint`
  was removed in Next 16; the script calls `eslint .`. Don't reintroduce
  `FlatCompat` — it crashes under ESLint 9.39.

## Layout & conventions

- `@/*` maps to `src/*`.
- `src/auth.ts` — NextAuth config; exports `auth`, `handlers`, `signIn`,
  `signOut`. Session carries `user.id` and `user.role` (see
  `src/types/next-auth.d.ts`).
- `src/lib/prisma.ts` — singleton Prisma client; import `prisma` from here.
- `src/lib/auth-guards.ts` — `getCurrentUser` / `requireUser` / `requireAdmin` /
  `requirePageUser`. Pages use `requirePageUser` (redirects to `/login`, or to
  `/change-password` when one is pending); queries and actions use
  `requireUser`, which **throws** while a password change is pending. That
  throw is the real enforcement — a page redirect only hides the UI, and every
  Server Action is reachable over HTTP without it.
- `src/lib/validations.ts` — Zod schemas; input DTO types are inferred here.
- `src/lib/queries.ts` — **read** helpers for Server Components. Plain async
  functions (no `"use server"`); they apply visibility rules.
- `src/lib/actions/*.ts` — **mutations** as Server Actions (`"use server"`).
  Every exported function must be async; keep non-exported helpers internal.
  Every export is also a public HTTP endpoint, so don't leave unreachable ones
  lying around.
- `src/lib/use-action.ts` — `useAction()`, the client hook every mutating
  control uses: runs an action in a transition and gives back
  `{ pending, error, setError, run }`. `run(action, { failure, onSuccess,
  onError, refresh })` refreshes on success by default; pass `refresh: false`
  when the action navigates away or only changes client state. Don't hand-roll
  the `useTransition` + try/catch + `setError` trio again.
- UI lives in `src/app` (routes) and `src/components` (`ui/` = shadcn).

### Authorization model

- **ADMIN**: full access to all recipes, tags, ingredients.
- **USER**: CRUD on their own recipes; can read their own + any `PUBLIC` recipe.
- Reads are filtered by `visibilityWhere(user)` in `queries.ts`. Mutations call
  `assertCanModifyRecipe` (owner or admin). Always re-check auth inside the
  action/query — never trust the client.
- There is **no admin rename/delete for a tag or ingredient entity**. Those
  actions existed but no UI ever reached them, so they were removed; `/tags`
  only hearts, links and adds. Re-add them next to the UI that needs them.
- Tags and ingredients are created **seamlessly** by name when saving a recipe
  (case-insensitive, cross-lingual reuse); see `resolveTags` /
  `resolveIngredients` in `actions/_shared.ts`. Both run one shared algorithm
  over a per-domain `EntityStore`, so a fix reaches tags and ingredients at
  once — that unification is the point, don't fork it back apart.

### Sign-in methods

- The operator picks them: `AUTH_METHODS` (`google`, `password`, or both) and
  `AUTH_PASSWORD_IDENTIFIER` (`username` | `email`). Read them through
  `src/lib/auth-methods.ts`, never `process.env` directly, so the login page
  and the actions can't disagree. Hiding a form is cosmetic; each action calls
  `assertPasswordAuthEnabled` itself.
- Password sign-in does **not** use Auth.js's Credentials provider, which
  supports the JWT session strategy only ("Signing in with credentials only
  supported if JWT strategy is enabled"). This app uses **database** sessions
  and depends on them — the session callback gets the live user row, which is
  why settings and `role` take effect immediately. So `signInWithPassword`
  issues a session directly via `src/lib/session-cookie.ts`, the same way the
  dev sign-in always has. Don't "fix" this by switching to JWT.
- `sessionCookieName()` mirrors Auth.js's rule: `__Secure-` prefix over https,
  bare name otherwise. Get it wrong and the cookie is set but every request
  still reads as signed out.
- Passwords are salted scrypt via `src/lib/password.ts` (Node built-in, no
  dependency). The stored string names its algorithm, so it can be migrated.
- **No self-registration.** Admins create accounts (`createUserAccount`) with a
  starting password and `mustChangePassword: true`; the person replaces it on
  first sign-in. An empty instance offers one-time first-admin setup on
  `/login` — `AUTH_ADMIN_EMAILS` fires on the NextAuth sign-in event, which a
  password-only deployment never reaches, so without it there'd be no way in.
- **Google allowlist**: `lib/allowed-emails.ts` decides who may sign in with
  Google — `AUTH_ALLOWED_EMAILS` **union** the `AllowedEmail` table (admin-
  managed, no restart). Both empty means *no restriction*, which is what the app
  did before the table existed; preserve that, or adding an allowlist feature
  silently locks existing deployments out. Env entries are deliberately not
  removable in-app so an admin can't strand themselves. Removing an entry also
  revokes that user's sessions, because the `signIn` callback only runs at
  sign-in and they would otherwise keep access for up to 30 days.
- `email` and `username` are both nullable and both unique: a Google account
  has no username, a username account has no email. Anything rendering an
  identifier must handle either being null.

## Gotchas

- Server Action and query modules import `prisma` — never import them into a
  Client Component.
- Recipe images: `src/lib/storage.ts` validates + writes files under
  `public/uploads/recipes/` (a persistent Docker volume) and returns a public
  `/uploads/recipes/<uuid>.<ext>` path. The `uploadRecipeImage` Server Action
  (`src/lib/actions/images.ts`) wraps it; the form uploads first, then passes the
  returned path to `createRecipe`/`updateRecipe` as `imagePath`. Update/delete
  clean up the previous file. Allowed: jpeg/png/webp/gif, max 5 MB.
- The production server only serves `public/` files that existed when it
  started, so images uploaded at runtime would 404 (dev serves `public/` from
  disk per-request, masking this). `src/app/uploads/recipes/[filename]/route.ts`
  serves them from disk as a fallback — don't delete it.
- `.env` is git-ignored; `.env.example` is the source of truth for required vars
  (`DATABASE_URL`, `AUTH_SECRET`, `GOOGLE_CLIENT_ID/SECRET`).

## Phase progress (PLAN.md §7)

- ✅ Phase 1 — scaffold, Tailwind/shadcn, Docker + Postgres
- ✅ Phase 2 — Prisma schema, initial migration, NextAuth + Google
- ✅ Phase 3 — CRUD Server Actions for Recipes, Tags, Ingredients
- ✅ Phase 4 — image upload (local file storage)
- ✅ Phase 5 — UI: nav, recipe card, create/edit form, recipe/list/tags/account
  pages, login (Google + dev-only sign-in)
- ✅ Phase 6 — dashboard (hearted-tag sections, divider, filterable all-recipes list)

All core phases (PLAN.md §7) are complete. Remaining work is the Post-Core
enhancements (PLAN.md §8): image optimization (sharp), serving scaling, URL import.

## Auth & UI notes

- **Local sign-in:** Google needs real credentials, so the `/login` page also
  has a **dev-only** sign-in (`src/lib/actions/dev-auth.ts`) that creates a real
  DB Session + sets the `authjs.session-token` cookie. Gated to non-production.
  It **upserts the role**, so signing in as an existing email with the role set
  to `USER` demotes that account — the form defaults to `ADMIN` for that reason.
  It also bypasses NextAuth entirely, so anything hooked to the `signIn` event
  (admin bootstrap, list-invite consumption) has to be called here too.
- shadcn primitives in `src/components/ui` are hand-written (no Radix) to keep
  deps light. The mobile nav uses a `useState` toggle, not Radix Sheet.
- Recipe images render with plain `<img>` (not `next/image`) since uploads are
  runtime files, not statically known at build.
- The recipe form has **two** hidden file inputs feeding one `onAddImages`:
  the picker (strict MIME allow-list, `multiple`) and the camera
  (`capture="environment"`, `image/*`, one shot). A phone is only offered its
  camera for a broad `accept`, hence the split. No permission code — the
  browser/OS prompts — and no secure context needed, unlike `getUserMedia`, so
  it works over plain http on the LAN. Desktop ignores `capture` and shows a
  picker.
- The qty/unit/name ingredient editor is **one** component,
  `components/ingredient-rows.tsx`, used by the recipe form and by the batch
  bar's "add ingredients" panel. `parseIngredientRows` lives there too, so the
  rule "a quantity must be a positive number" is stated once rather than in
  both submit handlers.
- Protected pages guard with `getCurrentUser()` → `redirect("/login")`.
- **Notes** (`RecipeNote`) are a private notepad, one per (user, recipe) — not a
  comment thread. Anyone who can *view* a recipe may note it, so the guard in
  `actions/notes.ts` is view permission, not ownership. `recipeDetailInclude`
  takes the viewer's id and scopes the included note by it; that `where` is the
  only thing keeping notes private, so always pass the **current** user, never
  a recipe's author.
- **Autocomplete** for ingredient/tag entry: `src/lib/suggest.ts` is the pure
  matcher (fold = lowercase + `ß`→`ss` + diacritics dropped, plus an `ue`-style
  expanded key, so "Kart"/"suss"/"suess" all hit). `getEntityVocabulary()` in
  `queries.ts` preloads every entity with **all** its surface forms and merges
  the curated dictionary — enriching stored entities with translations they lack
  (legacy rows often have only their English alias) and appending unseen terms as
  `id: null`. Pages pass it down; `EntityAutocomplete` filters client-side, so
  there is no per-keystroke roundtrip. Used by the recipe form (ingredient rows +
  tag input), the `RecipeFilters` search box (picking applies a filter, so
  dictionary-only entries are excluded there), and `AddTagForm` on `/tags`.
  If the vocabulary ever exceeds a few thousand entities, switch the callers to a
  debounced server search on `normalized` instead.
- **Recipe search** is fuzzy and lives in `src/lib/suggest.ts`'s sibling
  `src/lib/recipe-search.ts`. It runs as a *prefilter*: raw SQL returns recipe
  ids ranked by relevance, which `getRecipes` applies as `id IN (…)` so
  visibility rules, tag/ingredient filters and the typed includes stay put.
  Matching folds both sides the same way the autocomplete does (both keys, so
  "suss"/"suess"/"süß" agree), then adds trigram similarity for typos; a search
  is ordered by relevance, no search stays alphabetical. It also covers the
  **viewer's own notes** — that branch is scoped by `viewerId`, which is what
  stops one person's private notes surfacing in another's results. Needs the **`pg_trgm`
  and `unaccent`** extensions — created by the `fuzzy_recipe_search` migration,
  which `migrate deploy` applies on the production DB too. `FUZZY_THRESHOLD`
  there is set below Postgres' 0.6 default on purpose; see its comment before
  changing it.
- **Pinned lists** (`RecipeList`): named, shareable recipe collections.
  Authorization funnels through `lib/list-access.ts` (`getListPermission` /
  `requireListPermission`, OWNER > EDITOR > VIEWER); "no such list" and "no
  access" raise the same error so ids can't be probed, and **admins get no
  blanket access** — a list is social, not library content. Sharing is by
  secret link (`shareToken`, rotate to revoke) *and* by email; an email with no
  account yet becomes a `RecipeListInvite`, consumed in the NextAuth `signIn`
  event (and in `dev-auth.ts`, which bypasses NextAuth). **Membership grants
  READ on pinned recipes** via the third branch of `visibilityWhere` — never
  write, since `assertCanModifyRecipe` is unchanged.
- **Batch editing**: `RecipeSelectionProvider` (rendered by `RecipeBrowser`)
  holds the selected ids; because its position in the tree is stable across
  same-route navigations, a selection survives paging. `SelectableCard` wraps
  the server-rendered card and covers it with a click-swallowing button while
  selection mode is on, so `RecipeCard` stays untouched. Actions live in
  `lib/actions/batch.ts`: they resolve tags/ingredients **once** per batch (not
  per recipe — `resolveTags` is several queries and can create alias rows),
  write joins with `skipDuplicates`, and silently skip recipes the user can't
  modify, returning `{ updated, skipped }` for the bar to report. Adding an
  ingredient never overwrites a recipe's existing quantity.
- The filterable list lives in `RecipeBrowser` (server) + `RecipeFilters`
  (client, URL-driven: `?q=&tags=a,b&ingredients=c`), shared by `/` and
  `/recipes`. The dashboard `/` adds hearted-tag sections above it; those rows
  are independent of the filter (the filter only narrows the All Recipes list).
