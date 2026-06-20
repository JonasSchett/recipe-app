# Deploying to Unraid (recipes.schett.io)

The app runs as two containers (`db` + `app`) via `docker-compose.yml`. The app
image is built in CI and pulled from GitHub Container Registry (GHCR); all
secrets are read at runtime from `.env`, so nothing sensitive is in the image.

```
browser ──https(443)──▶ Nginx Proxy Manager (*.schett.io cert) ──http──▶ NAS:3100 ──▶ app:3000
                                                                                          │
                                                                                    db (internal)
```

## 1. One-time: build the image (GHCR)

Pushing to `main` triggers `.github/workflows/docker-publish.yml`, which builds
and pushes `ghcr.io/<owner>/recipe-app:latest` (plus `:sha-…` and version tags).
`GITHUB_TOKEN` is automatic — no extra secrets needed.

The repo must be named **`recipe-app`** for the image name to match the compose
file (`ghcr.io/${GHCR_OWNER}/recipe-app`). The package is private by default;
either make it public (Packages → Package settings → visibility) or log in on
the NAS once (step 3).

## 2. Google OAuth

Use a **separate OAuth client** (same Google Cloud project as Immich is fine):
Credentials → Create OAuth client ID → Web application.

- **Authorized JavaScript origin:** `https://recipes.schett.io`
- **Authorized redirect URI:** `https://recipes.schett.io/api/auth/callback/google`

Keep the OAuth consent screen in **Testing** and add your Google account as a
test user → only you can sign in. (Belt and braces: also set `AUTH_ALLOWED_EMAILS`
in step 3.)

## 3. On the NAS

Get the repo and create `.env`:

```bash
mkdir -p /mnt/user/appdata/recipe-app
cd /mnt/user/appdata/recipe-app
git clone <your-repo-url> .
cp .env.example .env
```

Edit `.env` for production:

```dotenv
AUTH_SECRET="<openssl rand -base64 32>"
AUTH_URL="https://recipes.schett.io"
NEXTAUTH_URL="https://recipes.schett.io"
GOOGLE_CLIENT_ID="…"
GOOGLE_CLIENT_SECRET="…"
AUTH_ALLOWED_EMAILS="you@gmail.com"      # lock sign-in to just you
GHCR_OWNER="your-github-username"        # lowercase
IMAGE_TAG="latest"
DATA_DIR="/mnt/user/appdata/recipe-app"
POSTGRES_PASSWORD="<a strong password>"
```

If the GHCR package is private, log in once (needs a PAT with `read:packages`):

```bash
echo <YOUR_PAT> | docker login ghcr.io -u <your-github-username> --password-stdin
```

Start it (Docker Compose Manager → Add Stack pointing here, or CLI):

```bash
docker compose pull
docker compose up -d
```

Migrations apply automatically on startup. Data persists in
`DATA_DIR/postgres` and `DATA_DIR/uploads`.

## 4. Nginx Proxy Manager

Add a Proxy Host:

- **Domain:** `recipes.schett.io`
- **Forward:** `http` → `<nas-ip>` → port `3100`
- **SSL:** `*.schett.io` cert, Force SSL, HTTP/2
- Websockets support: on

Point `recipes.schett.io` at the NAS the same way as your other local-only
hosts (local DNS + your usual access restriction).

## 5. First sign-in → make yourself admin

The first Google sign-in creates your `User` row as a normal `USER`. Promote
yourself once so you can manage all recipes/tags:

```bash
docker compose exec db psql -U recipe -d recipe \
  -c "UPDATE \"User\" SET role='ADMIN' WHERE email='you@gmail.com';"
```

## Updating after code changes

1. Locally: make changes. If `prisma/schema.prisma` changed, run
   `npm run db:migrate` to create a migration, then commit **including** the new
   `prisma/migrations/…` files and push to `main`. CI rebuilds the image.
2. On the NAS:
   ```bash
   cd /mnt/user/appdata/recipe-app
   git pull            # only needed if compose/.env files changed
   docker compose pull # fetch the new image
   docker compose up -d
   ```
   Pending migrations apply automatically on startup; `postgres` and `uploads`
   data are untouched.

Pin a specific build instead of `latest` by setting `IMAGE_TAG` (e.g. a
`sha-abc1234` or `v1.2.0` tag) in `.env`.

## Backups

Back up `DATA_DIR/postgres` and `DATA_DIR/uploads` (e.g. the Unraid Appdata
Backup plugin), or `docker compose exec db pg_dump -U recipe recipe > dump.sql`.
