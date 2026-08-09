# Deploying

Two containers (`db` + `app`) defined by `docker-compose.yml`. The `app` image
is built by CI and pulled from GitHub Container Registry (GHCR). All secrets are
read at runtime from `.env`, so nothing sensitive is baked into the image (the
image can be — and is — public).

```
browser ──https(443)──▶ Nginx Proxy Manager (*.example.com cert) ──http──▶ NAS:3100 ──▶ app:3000
                                                                                          │
                                                                                    db (internal)
```

The walkthrough below is concrete for `recipes.example.com` on Unraid, but applies
to any Docker host + HTTPS reverse proxy.

## Prerequisites

- A Docker host. On Unraid: install the **Docker Compose Manager** plugin
  (Community Apps).
- A reverse proxy terminating **HTTPS** with a valid cert — Google OAuth requires
  https. We use Nginx Proxy Manager with the `*.example.com` wildcard cert.
- A hostname pointing at the host (e.g. `recipes.example.com`). LAN-only is fine —
  Google never connects to the app, it only redirects your browser.
- A Google OAuth client (step 1) — **only if** you want Google sign-in. Set
  `AUTH_METHODS=password` instead and you can skip step 1 entirely.

## 1. Google OAuth client

In Google Cloud Console → Credentials → Create OAuth client ID → **Web
application** (a dedicated client; the same project as other apps is fine):

- **Authorized JavaScript origin:** `https://recipes.example.com`
- **Authorized redirect URI:** `https://recipes.example.com/api/auth/callback/google`

Keep the consent screen in **Testing** and add your Google account as a test
user, so only you can sign in. (Also set `AUTH_ALLOWED_EMAILS`, below.)

## 2. Environment values

The stack reads a `.env`. Full reference: see the table in [README](./README.md#configuration-environment-variables).
Minimum for production:

```dotenv
AUTH_SECRET=<openssl rand -base64 32>
AUTH_URL=https://recipes.example.com
NEXTAUTH_URL=https://recipes.example.com
GOOGLE_CLIENT_ID=…
GOOGLE_CLIENT_SECRET=…
AUTH_ALLOWED_EMAILS=you@gmail.com        # lock sign-in to just you
GHCR_OWNER=your-github-username          # lowercase!
IMAGE_TAG=latest
DATA_DIR=/mnt/user/appdata/recipe-app
POSTGRES_PASSWORD=<alphanumeric, no @ : / ? # %>
```

Do **not** set `DATABASE_URL` — compose builds it from the `POSTGRES_*` values
(host `db`, on the internal network).

## 3. Deploy with Docker Compose Manager (web UI)

Because the compose file uses the public GHCR image and absolute bind-mount
paths, you don't need to clone the repo on the NAS.

1. **Docker** tab → **Compose Manager** → **Add New Stack**, name it `recipe-app`.
2. Edit the stack → **Compose File**: paste the contents of `docker-compose.yml`
   from the repo (copy it from GitHub). You do **not** need `docker-compose.dev.yml`.
3. Edit the stack's **`.env`**: paste the values from step 2.
4. Click **Compose Up**.

The image is public, so no login is needed. (If you make the package private,
first run `echo <PAT_with_read:packages> | docker login ghcr.io -u <user> --password-stdin`.)

Migrations apply automatically on startup. Watch the `app` container **Logs** for
`All migrations have been successfully applied` and `✓ Ready`. Data persists in
`DATA_DIR/postgres` and `DATA_DIR/uploads`.

**CLI alternative:** clone into `DATA_DIR`, `cp .env.example .env`, fill it in,
then `docker compose pull && docker compose up -d`.

## 4. Nginx Proxy Manager

Add a Proxy Host:

- **Domain:** `recipes.example.com`
- **Forward:** scheme `http` → `<nas-ip>` → port **`3100`** (host 3100 → container 3000)
- **SSL:** `*.example.com` cert, Force SSL, HTTP/2
- **Websockets support:** on

Point `recipes.example.com` at the NAS the same way as your other local-only hosts
(local DNS + your usual access restriction). Note: Google sign-in only works
through the https hostname — hitting `http://<nas-ip>:3100` directly fails OAuth.

## 5. First sign-in → make yourself admin

**With password sign-in** (`AUTH_METHODS` includes `password`), an instance
with no accounts shows a one-time setup form at `/login`. Fill it in and you
get the first admin account — nothing else to do. The form disappears as soon
as an account exists, and the server refuses the request too, so it can't be
used twice.

**With Google sign-in**, the simplest route is `AUTH_ADMIN_EMAILS=you@gmail.com`
in `.env` — that promotes you to ADMIN the first time you sign in. Failing
that, promote yourself directly:

```bash
docker compose exec db psql -U recipe -d recipe \
  -c "UPDATE \"User\" SET role='ADMIN' WHERE email='you@gmail.com';"
```

(In the Compose Manager, run this from the NAS console in the stack's project
folder, or use the `db` container's console.)

From there, **Account → Manage users** promotes others and — when password
sign-in is on — creates accounts.

## Updating after code changes

1. **Locally:** make changes. If `prisma/schema.prisma` changed, run
   `npm run db:migrate` to create a migration, then commit **including** the new
   `prisma/migrations/…` files and push to **`mainline`**. CI builds and pushes a
   new `:latest` image (watch the Actions tab).
2. **On the NAS:** in Docker Compose Manager, click the stack's **Update / pull**
   action (circular-arrows icon) to fetch the new image and recreate the
   container. A plain *Compose Up* reuses the old image, so use Update/pull.
   - CLI equivalent: `docker compose pull && docker compose up -d`.

Pending migrations apply automatically on restart; `postgres` and `uploads` data
are untouched. Pin a specific build by setting `IMAGE_TAG` (e.g. `sha-abc1234`).

## Backups

Back up `DATA_DIR/postgres` and `DATA_DIR/uploads` (e.g. the Unraid Appdata
Backup plugin), or dump the database:

```bash
docker compose exec db pg_dump -U recipe recipe > recipe-backup.sql
```
