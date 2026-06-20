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
docker compose up -d db   # start just Postgres for local dev
docker compose up -d --build   # full stack (app + db)
```

After changing `prisma/schema.prisma`, run `npm run db:migrate` and commit the
generated migration under `prisma/migrations/`.

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
- `src/lib/auth-guards.ts` — `getCurrentUser` / `requireUser` / `requireAdmin`.
- `src/lib/validations.ts` — Zod schemas; input DTO types are inferred here.
- `src/lib/queries.ts` — **read** helpers for Server Components. Plain async
  functions (no `"use server"`); they apply visibility rules.
- `src/lib/actions/*.ts` — **mutations** as Server Actions (`"use server"`).
  Every exported function must be async; keep non-exported helpers internal.
- UI lives in `src/app` (routes) and `src/components` (`ui/` = shadcn).

### Authorization model

- **ADMIN**: full access to all recipes, tags, ingredients.
- **USER**: CRUD on their own recipes; can read their own + any `PUBLIC` recipe.
- Reads are filtered by `visibilityWhere(user)` in `queries.ts`. Mutations call
  `assertCanModifyRecipe` (owner or admin). Tag/ingredient rename & delete are
  admin-only. Always re-check auth inside the action/query — never trust the
  client.
- Tags and ingredients are created **seamlessly** by name when saving a recipe
  (case-insensitive reuse); see `resolveTagIds` / `resolveIngredients`.

## Gotchas

- Server Action and query modules import `prisma` — never import them into a
  Client Component.
- Recipe images: `src/lib/storage.ts` validates + writes files under
  `public/uploads/recipes/` (a persistent Docker volume) and returns a public
  `/uploads/recipes/<uuid>.<ext>` path. The `uploadRecipeImage` Server Action
  (`src/lib/actions/images.ts`) wraps it; the form uploads first, then passes the
  returned path to `createRecipe`/`updateRecipe` as `imagePath`. Update/delete
  clean up the previous file. Allowed: jpeg/png/webp/gif, max 5 MB.
- `.env` is git-ignored; `.env.example` is the source of truth for required vars
  (`DATABASE_URL`, `AUTH_SECRET`, `GOOGLE_CLIENT_ID/SECRET`).

## Phase progress (PLAN.md §7)

- ✅ Phase 1 — scaffold, Tailwind/shadcn, Docker + Postgres
- ✅ Phase 2 — Prisma schema, initial migration, NextAuth + Google
- ✅ Phase 3 — CRUD Server Actions for Recipes, Tags, Ingredients
- ✅ Phase 4 — image upload (local file storage)
- ⬜ Phase 5 — UI components (Nav, Recipe Card, Forms)
- ⬜ Phase 6 — dashboard (hearted-tag sections, list, multi-filter)
