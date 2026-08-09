# Recipe App

A self-hosted, mobile-friendly web app for managing, sharing, and viewing
recipes. See [`PLAN.md`](./PLAN.md) for the full implementation plan.

## Tech stack

- **Next.js 16** (App Router) + **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui** (`new-york` style, neutral base)
- **PostgreSQL** + **Prisma 6**
- **Auth.js / NextAuth v5** (Google provider, database sessions)
- **Docker Compose** for deployment (app + database)

## Project status

All six core phases from [`PLAN.md`](./PLAN.md) §7 are complete:

- Full Prisma schema (Auth.js models + Recipe / Ingredient / Tag / join tables)
  with role-based access (ADMIN / USER) and PUBLIC / PRIVATE visibility
- Google sign-in (Auth.js v5, database sessions) with an optional email allowlist
- CRUD server actions for recipes, tags, and ingredients (tags/ingredients are
  created seamlessly by name)
- Local image upload (validated, stored on disk, served from `/uploads`)
- UI: nav, recipe cards, create/edit form, and a dashboard with hearted-tag
  sections plus a multi-select tag/ingredient filter
- Deployed via Docker: a GHCR image built by CI, run behind a reverse proxy —
  see [`DEPLOY.md`](./DEPLOY.md)

Remaining work is the Post-Core enhancements in PLAN.md §8 (image optimization,
serving scaling, URL import).

## Configuration (environment variables)

Copy `.env.example` to `.env`. One file is read by both local dev (`npm run dev`)
and the Docker stack; for the container, `docker-compose.yml` overrides
`DATABASE_URL` and assembles it from the `POSTGRES_*` values (so you don't set
`DATABASE_URL` in production).

| Variable | Required | Used by | Notes |
| --- | --- | --- | --- |
| `AUTH_SECRET` | yes | both | Session/JWT signing. `openssl rand -base64 32`. |
| `AUTH_METHODS` | optional | both | Sign-in methods offered, comma-separated: `google`, `password`. Unset = `google`. |
| `AUTH_PASSWORD_IDENTIFIER` | optional | both | What a password account logs in with: `username` (default) or `email`. |
| `AUTH_URL` | yes | both | Public base URL. Dev: `http://localhost:3000`. Prod: `https://recipes.example.com`. |
| `NEXTAUTH_URL` | yes | both | Same value as `AUTH_URL` (legacy alias). |
| `GOOGLE_CLIENT_ID` | prod | both | Google OAuth client ID. |
| `GOOGLE_CLIENT_SECRET` | prod | both | Google OAuth client secret. |
| `AUTH_ALLOWED_EMAILS` | optional | both | Comma-separated allowlist of emails that may sign in. Empty = anyone who passes Google. Google only — password accounts are created by an admin. |
| `DATABASE_URL` | dev only | `npm run dev` | Local Postgres URL. Ignored in the container (compose sets it). |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | prod | compose | DB credentials; compose builds the container `DATABASE_URL` from these. Keep the password alphanumeric (no `@ : / ? # %`). |
| `GHCR_OWNER` | prod | compose | GitHub owner for the image path, **lowercase** (e.g. `your-github-username`). |
| `IMAGE_TAG` | prod | compose | Image tag to run (default `latest`; pin to a `sha-…`/`vX.Y.Z` if desired). |
| `DATA_DIR` | prod | compose | Host directory for persistent data (`postgres/` + `uploads/`). |

> Locally you don't need Google credentials — the `/login` page has a dev-only
> sign-in (disabled when `NODE_ENV=production`).

### Choosing how people sign in

`AUTH_METHODS` decides what `/login` offers. Three common setups:

| Goal | Settings |
| --- | --- |
| Google only (default) | `AUTH_METHODS=google` + `GOOGLE_CLIENT_*` |
| Username + password, no email anywhere | `AUTH_METHODS=password`, `AUTH_PASSWORD_IDENTIFIER=username` |
| Email + password | `AUTH_METHODS=password`, `AUTH_PASSWORD_IDENTIFIER=email` |

Both can be on at once (`AUTH_METHODS=google,password`).

**Password accounts have no self-registration.** An admin creates each one from
**Account → Manage users** and hands over a starting password, which the person
must replace on first sign-in. On a brand-new instance with no accounts at all,
`/login` instead offers a one-time setup form that creates the first admin —
that's how a password-only install gets its first way in, since
`AUTH_ADMIN_EMAILS` only applies to Google sign-in.

Passwords are stored as salted scrypt digests (Node's built-in `crypto`, no
extra dependency). Changing or resetting a password signs that account out
everywhere else.

## Local development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy the environment template and fill it in:
   ```bash
   cp .env.example .env
   # generate a secret:  openssl rand -base64 32
   ```
3. Start a local database:
   ```bash
   docker compose -f docker-compose.dev.yml up -d
   ```
4. Apply the schema:
   ```bash
   npm run db:migrate
   ```
5. Run the dev server:
   ```bash
   npm run dev
   ```
   App at http://localhost:3000.

At the login page, use **"Sign in as test user"** (the dev-only card) to get in
without Google. Setting up real Google OAuth is only needed for production — see
[`DEPLOY.md`](./DEPLOY.md).

## Production

The production stack (`docker-compose.yml`) pulls a prebuilt image from GitHub
Container Registry and runs behind a reverse proxy. See **[DEPLOY.md](./DEPLOY.md)**
for the full Unraid + Nginx Proxy Manager walkthrough. In short:

```bash
docker compose pull && docker compose up -d
```

The app applies pending Prisma migrations on start. Data persists under
`DATA_DIR` (`postgres/` and `uploads/`). Images are built and pushed by
`.github/workflows/docker-publish.yml`.

## Useful scripts

| Script              | Description                              |
| ------------------- | ---------------------------------------- |
| `npm run dev`       | Start the dev server                     |
| `npm run build`     | `prisma generate` + production build     |
| `npm run db:migrate`| Create/apply a dev migration             |
| `npm run db:deploy` | Apply migrations (production)            |
| `npm run db:studio` | Open Prisma Studio                       |
| `npm run lint`      | Lint                                     |
