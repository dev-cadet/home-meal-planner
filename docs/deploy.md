# Deploying

One container, one volume, no database server. Every push to `main` publishes
a fresh image to `ghcr.io/dev-cadet/home-meal-planner` (`.github/workflows/docker-build.yml`),
so a deploy host needs only `compose.yaml` and `.env` — no source checkout.

## First run

```bash
# On a deploy host, just these two files are needed:
#   compose.yaml   — copy from app/compose.yaml in this repo
#   .env           — create fresh, see below

# 1. A signing secret. Without it the app refuses to start.
printf 'BETTER_AUTH_SECRET=%s\n' "$(openssl rand -base64 32)" >> .env
printf 'BETTER_AUTH_URL=http://localhost:3000\n' >> .env

# 2. Pull the published image and start
docker compose pull
docker compose up -d
```

Developing locally, `compose.yaml` sits in `app/` alongside the source —
`.env` there is the same file `next dev` reads, so append rather than
overwrite if it already has content. To test an unpublished change, build
from that checkout instead of pulling by layering `compose.build.yaml` on
top:

```bash
docker compose -f compose.yaml -f compose.build.yaml up -d --build
```

`compose.yaml` itself deliberately has no `build:` section — some platforms
(Coolify included) copy out only that one file and try to build with it
regardless of whether `image:` is also set, which fails with `open
Dockerfile: no such file or directory` since the rest of the checkout isn't
there. Deploying with plain `docker compose pull && docker compose up -d`
never triggers a build, so this doesn't come up outside local dev.

Then open <http://localhost:3000/sign-up>. **The first account needs no invite
code and becomes the administrator** — that rule exists so a fresh deployment
can never lock you out. From then on, sign-up requires a code from
Settings → Invite codes (unless `ALLOW_REGISTRATION=true`).

Migrations run automatically at startup, before the server accepts a single
request. There is no separate migrate step.

## Configuration

Every variable is listed with its default in `compose.yaml`. Only two matter
on day one:

| Variable | Notes |
|---|---|
| `BETTER_AUTH_SECRET` | **Required.** `openssl rand -base64 32`. Changing it signs everyone out. |
| `BETTER_AUTH_URL` | The origin browsers actually use. If it does not match, sign-in fails the CSRF origin check. |

Put both in `.env`, beside wherever `compose.yaml` ends up. On a source
checkout that's `app/.env` — the same file `next dev` reads locally, one set
of values for this household whichever way you're running it. It's gitignored
either way.

Set `TZ` to your own zone: it decides which calendar day is "today", and a
container's clock is UTC, so the default matters even in the UK.

### Public demo deployments

Three flags, all off by default, exist for running a public demo instance
(shared credentials, nobody should be able to change them or invite
themselves in):

| Variable | Effect |
|---|---|
| `DISABLE_SIGNUPS` | Overrides `ALLOW_REGISTRATION` and invite codes entirely once an account exists — sign-up is closed, full stop. The very first account is still always allowed, so an empty deployment can never lock itself out. |
| `DISABLE_PASSWORD_CHANGES` | Blocks both self-service password changes and admin-issued temporary passwords. A forced change already in progress is still let through, so this can't itself cause a lockout. |
| `SEED_ON_START` | Reloads the sample data set (30 meals, 10 plans, a week's schedule) on every container start. Destructive — clears and replaces it each time. Never enable this against a real household's data. |

A typical demo `.env` also sets `BETTER_AUTH_URL`/`BETTER_AUTH_SECRET` as
normal, then signs in with credentials seeded in some other way (manually,
or baked into a custom seed) — `SEED_ON_START` alone does not create an
account, since seeding deliberately never invents one (see
`src/lib/db/seed.ts`).

### Behind a reverse proxy

Set `BETTER_AUTH_URL` to the public origin (`https://meals.example.com`) and
forward `X-Forwarded-*`. Sign-in will fail with a 403 if the origin the browser
sends does not match this value — that is the CSRF check doing its job, not a
bug.

## Data

Everything lives in the `meal-planner-data` volume as `app.db`, including meal
photos, which are stored in the database rather than on a separate uploads
volume.

The volume mounts a **directory**, not a file. WAL mode writes `app.db-wal` and
`app.db-shm` alongside the database; mounting the bare `.db` corrupts on
restart.

```bash
docker compose down      # keeps the volume
docker compose down -v   # DELETES the volume and all data
```

### Backups

```bash
docker compose exec app node -e "\
  const {createClient}=require('@libsql/client');\
  createClient({url:'file:/data/app.db'})\
    .execute(\"VACUUM INTO '/data/backup.db'\")\
    .then(()=>console.log('ok'))"

docker compose cp app:/data/backup.db ./app-backup.db
```

`VACUUM INTO` takes a consistent snapshot of a live database, so the app keeps
running. **Do not just copy `app.db`** — with WAL enabled the newest writes are
still in `app.db-wal`, and a plain copy silently loses them.

From a source checkout, `bun run db:backup` does the same thing.

To restore: stop the app, replace `app.db`, and delete any `app.db-wal` and
`app.db-shm` beside it.

## Lost passwords

There is no SMTP, so there is no self-serve reset.

- **A user forgot theirs** — an admin issues a temporary password in
  Settings → Household. The user is forced to change it at next sign-in.
- **The only admin forgot theirs** — the escape hatch. The runtime image
  contains neither Bun nor the scripts (that is the point of a standalone
  build), so the reset runs from a source checkout against the database file.
  On a pull-only deploy host without one, `git clone` the repo somewhere
  temporary first — you only need it for this, not for normal operation:

  ```bash
  # 1. Stop the app so nothing is mid-write
  docker compose stop app

  # 2. Copy the database out (run beside compose.yaml) into the checkout's app/
  docker compose cp app:/data/app.db path/to/checkout/app/restore.db

  # 3. Reset from inside that checkout
  cd path/to/checkout/app
  DATABASE_PATH=./restore.db bun run reset-password you@example.com

  # 4. Put it back and restart (run beside compose.yaml again)
  docker compose cp path/to/checkout/app/restore.db app:/data/app.db
  docker compose start app
  rm path/to/checkout/app/restore.db
  ```

  Stopping first matters: with WAL enabled, copying a live database can miss
  the newest writes. Needing filesystem access to the host is itself the
  authorisation for this.

## Health

`GET /api/health` is unauthenticated and runs a real query, so a process that
is up but cannot reach its database reports unhealthy rather than lying.
Compose polls it every 30s.

```bash
curl -s localhost:3000/api/health
# {"status":"ok","database":"ok","ms":0}
```

## Notes

- The image is ~450MB, most of it the Node base plus the native `sharp` and
  `libsql` binaries.
- It runs as the unprivileged `node` user (uid 1000).
- **Single instance only.** SQLite allows one writer, and the app assumes one
  process. Do not scale the service to more than one replica.
- Bun installs dependencies during the build but Node runs the build itself:
  `bun run build` dies with `SIGILL` inside a container on CPUs lacking the
  instruction set Bun's default binary assumes.
