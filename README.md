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

This is the **core scaffold** (Plan §7 Phase 1, plus the Prisma schema and
Auth.js wiring). Implemented so far:

- Next.js app shell, Tailwind v4 + shadcn theme tokens
- Full Prisma schema (Auth.js models + Recipe / Ingredient / Tag / join tables)
- Auth.js config with the Google provider and `role` on the session
- Dockerfile (standalone output) + `docker-compose.yml` (db + app, persistent
  volumes for Postgres and uploads)

Still to come: recipe CRUD, image upload, UI components, and the dashboard.

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
3. Start a database (the compose `db` service is enough):
   ```bash
   docker compose up -d db
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

### Google OAuth

Create an OAuth client in the Google Cloud Console and set the authorized
redirect URI to `<AUTH_URL>/api/auth/callback/google`. Put the client id and
secret in `.env`.

## Production (Docker Compose)

```bash
cp .env.example .env   # set AUTH_SECRET, Google creds, strong POSTGRES_PASSWORD
docker compose up -d --build
```

The app applies pending Prisma migrations on start, then serves on port 3000.
Uploaded images persist in the `uploads` volume; database data in
`postgres-data`.

## Useful scripts

| Script              | Description                              |
| ------------------- | ---------------------------------------- |
| `npm run dev`       | Start the dev server                     |
| `npm run build`     | `prisma generate` + production build     |
| `npm run db:migrate`| Create/apply a dev migration             |
| `npm run db:deploy` | Apply migrations (production)            |
| `npm run db:studio` | Open Prisma Studio                       |
| `npm run lint`      | Lint                                     |
