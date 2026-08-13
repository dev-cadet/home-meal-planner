# Home Meal Planner — Architecture Notes

The design record for this app: the decisions that shape it and why. Last updated: 2026-08-16.

---

## 1. Decisions locked in

| Area | Decision |
|---|---|
| Framework | Next.js 16.3 (App Router, `src/`), React 19.2, TypeScript strict |
| Styling | Tailwind v4 (CSS-first `@theme`), mobile-first |
| Runtime / PM | Bun 1.3 |
| Database | **SQLite** (WAL mode), via `@libsql/client` |
| ORM | **Drizzle** 0.45 + drizzle-kit migrations |
| Auth | **Better Auth**, email + password, no SMTP (verification off) |
| Access | **Login required for everything.** No anonymous browsing |
| Registration | `ALLOW_REGISTRATION=true` → open signup. When false → **invite code required**. First user ever becomes admin |
| Visibility | **Everything is shared.** No per-row privacy, no ownership filtering |
| Edit rights | Wiki-style — any authenticated user may edit anything |
| User refs | Soft: `created_by_id` / `updated_by_id`, nullable, `ON DELETE SET NULL` |
| Calendar | One shared household calendar |
| Day structure | Fixed slots: breakfast / lunch / dinner / snack |
| Ingredients | Structured: quantity + unit + free-text name |
| **Images** | **Stored in SQLite as `BLOB`. 2MB upload cap, auto-crunched server-side** |
| **Servings** | **Display-only reference. Does *not* scale anything** |
| Tags | One vocabulary, on meals only. A plan's tags are the derived union of its meals' tags — never stored on the plan itself |
| Shopping list | **Runtime projection** by default (read-only, copy/share). Can be **saved per-user** to check items off, rename, and edit |
| Pins | **Per-user**, on meals, plans, and saved shopping lists. Never shared — my pins are invisible to everyone else |
| Plans ↔ Schedule | **Deliberately unlinked.** Plans are playlists; the Schedule is filled meal by meal |
| Navigation | Bottom bar `Home · Meals · Plans · Schedule · ➕`; Settings in top bar |
| Locale config | **Env vars**: `TZ`, `DATE_FORMAT`, `MEASUREMENT_SYSTEM`, `WEEK_STARTS_ON` — see §9 |
| Deploy | Single-service docker-compose |

### Vocabulary

- **Meal** — a recipe. Name, ordered method steps, servings, timings, structured ingredient rows, optional image, tags.
- **Plan** — a *playlist*: an unscheduled, ordered list of meals. No dates. Tags shown on it are derived from its meals'.
- **Schedule** — the calendar. Meals assigned to a specific date + slot.
- **Shopping list** — computed on demand from either a Plan or a date range. Can optionally be **saved**, becoming a real per-user entity with its own checked/renamed/edited state — see §6.
- **Pin** — a per-user "keep this at the top" marker on a meal, plan, or saved shopping list. Along with saved shopping lists, this is the app's only private, non-shared data — everything else is visible to every signed-in user.

> "Public" means *visible to any logged-in user*. Auth gates the app as a whole — there is no anonymous read path anywhere.

---

## 2. Next.js 16 constraints

Verified against the bundled docs in `app/node_modules/next/dist/docs/`, not from memory — this release has breaking changes and `app/AGENTS.md` warns about exactly this.

- **`middleware.ts` is deprecated**, renamed to **`proxy.ts`** (same behaviour, same root-level placement).
- **Proxy must not be the auth boundary.** The docs are explicit: it is for *optimistic* redirects only. Real enforcement belongs in a **Data Access Layer**.
- **`cookies()` is async** — `await cookies()`.
- **DAL pattern**: `verifySession()` wrapped in React `cache()` so it memoises across a single render pass.
- **Client Components cannot import the DAL.** Session data is resolved in a Server Component and passed down as props or via a context provider.
- **Server Actions cap request bodies at 1MB by default.** A 2MB image upload fails until `serverActions.bodySizeLimit` is raised — see §5.
- `unauthorized.ts` / `forbidden.ts` conventions exist behind the `authInterrupts` config flag — worth enabling for clean auth UX.
- **Cache Components** (`cacheComponents: true`) is opt-in. This app is almost entirely per-request and authenticated, so it stays **off**.

---

## 3. Database architecture

### Why SQLite

Sizing the actual workload: ~4 users, ~500 meals × ~10 ingredients, ~50 plans, and 5 years of schedule entries at 4 slots/day (~7,300 rows). **Under 20,000 rows** of relational data.

A separate database server for that is pure overhead. SQLite collapses the deployment to one container with one volume — no credentials, no network, no healthcheck, no startup ordering — and local dev needs no infrastructure at all.

*Considered and rejected*: **Postgres** (correct at 100× this scale, wasteful here); **PGlite** (Postgres-in-WASM — interesting, immature, solves a problem we don't have); **MySQL/MariaDB** (heavier, no benefit).

### Driver: `@libsql/client`, not `better-sqlite3`

Switched after `better-sqlite3` failed to install.

**v13.0.3 has no `install` script and no `prebuild-install` dependency** — it depends only on `node-addon-api` and always compiles through `node-gyp`. It therefore needs a full C++ toolchain on *every* machine that installs it, which killed it on a Windows dev box without Visual Studio, and would have forced `python3`/`make`/`g++` into the Docker build too. The earlier claim that debian-slim would fetch a clean prebuild was wrong for this version.

`@libsql/client` ships **prebuilt native binaries** for `win32-x64-msvc`, `linux-x64-gnu`, `linux-x64-musl`, `linux-arm64-*` and darwin — no compiler anywhere. It has a first-class Drizzle driver (`drizzle-orm/libsql`) with full transaction, batch and migrator support.

*Also considered*: Node 24's built-in `node:sqlite` — genuinely zero-dependency, but Drizzle 0.45 has no driver for it, and the only route in (`sqlite-proxy`) is an **async remote** driver whose callback has no transaction context. Wrong tool.

Nothing architectural changed: still SQLite, still one file, still one container. Only the client library differs.

### Concurrency

WAL mode gives **many concurrent readers plus one writer**. At household scale writes are a handful per minute at peak, so contention is a non-issue and `busy_timeout` absorbs what little there is.

**The real constraint: one app instance.** SQLite rules out horizontal scaling. An honest trade, and the right one here.

### Connection pragmas

Set on every connection, in one place:

```
journal_mode = WAL       -- concurrent readers
busy_timeout = 5000      -- wait out a writer instead of erroring
foreign_keys = ON        -- SQLite defaults this OFF
synchronous = NORMAL     -- safe with WAL, much faster than FULL
```

⚠️ **`foreign_keys = ON` is critical and easy to miss.** SQLite ignores foreign keys by default, which would silently break every `ON DELETE SET NULL` in §4 — the exact mechanism the soft-reference requirement depends on. A deleted user would leave dangling IDs instead of nulls, and **nothing would error**. This gets a dedicated test.

### Type mapping

| Concern | Decision | Why |
|---|---|---|
| **Instants** (`created_at`, `expires_at`, …) | `INTEGER` unix millis, **UTC** | A moment in time. Unambiguous, sorts numerically, Drizzle's `{ mode: 'timestamp_ms' }` returns a `Date`. |
| **Calendar dates** (`schedule_entry.date`) | `TEXT` as `YYYY-MM-DD` | **Not** an instant — see below. No timezone, sorts lexicographically. |
| Quantities | `REAL`, rounded at presentation | Cooking amounts don't need exactness; rounding to 2dp keeps `0.30000000000000004` out of the UI. |
| IDs | `TEXT` holding UUIDv7 | Time-sortable, so inserts stay local in the index — unlike UUIDv4. |
| Booleans | `INTEGER` 0/1 | Drizzle maps via `{ mode: 'boolean' }`. |
| Images | `BLOB` in a **separate table** | See §5. Keeps image bytes out of every list query. |

### Instants vs calendar dates

Two different kinds of temporal data, stored two different ways. Mixing them is the source of nearly every date bug.

| | Instants | Calendar dates |
|---|---|---|
| Examples | `created_at`, `updated_at`, `session.expires_at`, `invite_code.expires_at` | `schedule_entry.date` |
| Meaning | A moment that happened at one point globally | A square on a calendar |
| Storage | **`INTEGER` unix millis, UTC** | **`TEXT` `YYYY-MM-DD`, no zone** |
| Rendered | Converted to `TZ` for display | Never converted — shown as-is |

**Why the schedule date is not UTC.** "Curry on Tuesday 18 August" isn't a point in time; it's a label. Storing it as `2026-08-18T00:00:00Z` breaks in two ways:

- Rendered in any zone behind UTC, it lands on **17 August** — the meal moves to the wrong day.
- Stored as *local* midnight, a BST date becomes `2026-08-17T23:00:00Z`, so `.toISOString().slice(0,10)` returns the previous day **even in the UK**.

And it would make the data mutable by configuration: changing `TZ` later would retroactively shift which day every historical meal fell on.

A plain date has none of these failure modes. It also can't be corrupted by a DST transition, where local midnight is occasionally ambiguous or nonexistent.

### The timezone boundary

`TZ` is used in exactly **two** places, both at the edges:

1. **`todayInAppTz()`** — turns *now* into a `YYYY-MM-DD` string. Everything downstream ("this week", "next 3 days", the today-marker, default shopping-list ranges) is pure string/date arithmetic with no timezone involved.
2. **Formatting instants** for display.

```ts
// No date library needed, no ambiguity — en-CA formats as YYYY-MM-DD
new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
```

Confining `TZ` to one function means the entire timezone risk surface is a single unit-testable boundary, rather than smeared through every query and component. Tests pin it at `Pacific/Auckland` and `America/Los_Angeles` — zones on either side of UTC — so an off-by-one-day bug can't hide.

### Size budget

Images dominate the file, not rows. After crunching (§5), roughly:

| Content | Size |
|---|---|
| All relational data (~20k rows) | ~5 MB |
| 500 meal images (~200 KB full + ~25 KB thumb) | ~110 MB |
| **Total** | **~115 MB** |

Comfortable for SQLite. The thing to watch is **backups**: they copy the whole file, so retention costs scale with image count, not row count.

### Docker specifics

- **Base image: `node:24-slim`, not Alpine.** `libsql` ships both `linux-x64-gnu` and `linux-x64-musl` prebuilds, so SQLite alone would run on Alpine — but `sharp` (0.35.3, already installed as a Next dependency) is cleanest on glibc. Debian-slim keeps both native modules on their well-trodden path with no compiler in the image.
- Single volume at `/data`; `DATABASE_PATH=/data/app.db`.
- **Mount the *directory*, not the file.** WAL creates `app.db-wal` and `app.db-shm` sidecars; bind-mounting the bare `.db` corrupts on restart.
- Migrations run on boot, before the server accepts traffic.

### Migrations & backups

- drizzle-kit generates SQL files, committed to the repo. Never auto-`push` in production.
- SQLite's `ALTER TABLE` is limited; destructive changes make drizzle-kit rebuild the table. Fine at this size, but review generated SQL for column drops.
- Backups use the online `.backup()` API (safe against a live DB) on a schedule — one file, no dump/restore ceremony.

### Escape hatch

Moving to Postgres later is **not** a one-line swap: Drizzle schemas are dialect-specific (`sqliteTable` vs `pgTable`), so it means a schema rewrite plus a data migration. Realistically that day never comes here, but better stated than assumed.

---

## 4. Data model

```mermaid
erDiagram
    user ||--o{ session : has
    user ||--o{ account : has
    user ||--o{ invite_code : issues
    user |o..o{ meal : "created_by (soft)"
    user |o..o{ plan : "created_by (soft)"
    user |o..o{ schedule_entry : "created_by (soft)"
    user ||--o{ shopping_list : owns
    user ||--o{ meal_pin : pins
    user ||--o{ plan_pin : pins

    meal ||--o| meal_image : has
    meal ||--o{ meal_ingredient : contains
    meal ||--o{ meal_step : contains
    meal ||--o{ meal_tag : "tagged via"
    meal ||--o{ meal_pin : "pinned via"
    meal ||--o{ plan_item : "referenced by"
    meal ||--o{ schedule_entry : "referenced by"
    tag ||--o{ meal_tag : "applied via"
    plan ||--o{ plan_item : contains
    plan ||--o{ plan_pin : "pinned via"
    shopping_list ||--o{ shopping_list_item : contains

    user {
        text id PK
        text email UK
        text name
        int is_admin
    }
    invite_code {
        text code PK
        text created_by_id FK "NULL on delete"
        text used_by_id FK "NULL until redeemed"
        text expires_at
        text used_at
    }
    meal {
        text id PK
        text name
        int servings "display only"
        int prep_mins
        int cook_mins
        text image_hash "NULL if no image"
        text created_by_id FK "NULL on delete"
        text updated_by_id FK "NULL on delete"
    }
    meal_image {
        text meal_id PK_FK "CASCADE"
        blob full "~1200px WebP"
        blob thumb "~400px WebP"
        text mime
        int width
        int height
        text hash
    }
    meal_ingredient {
        text id PK
        text meal_id FK
        int position
        real quantity
        text unit
        text name "free text"
    }
    meal_step {
        text id PK
        text meal_id FK
        int position
        text text "method step"
    }
    tag {
        text id PK
        text name UK
    }
    meal_tag {
        text meal_id PK_FK "CASCADE"
        text tag_id PK_FK "CASCADE"
    }
    meal_pin {
        text user_id PK_FK "CASCADE"
        text meal_id PK_FK "CASCADE"
    }
    plan {
        text id PK
        text name
        text description
        text created_by_id FK "NULL on delete"
    }
    plan_item {
        text id PK
        text plan_id FK
        text meal_id FK
        int position
    }
    plan_pin {
        text user_id PK_FK "CASCADE"
        text plan_id PK_FK "CASCADE"
    }
    schedule_entry {
        text id PK
        text date "YYYY-MM-DD"
        text slot "breakfast|lunch|dinner|snack"
        text meal_id FK
        text created_by_id FK "NULL on delete"
    }
    shopping_list {
        text id PK
        text user_id FK "CASCADE, owner"
        text name
        int pinned
    }
    shopping_list_item {
        text id PK
        text shopping_list_id FK "CASCADE"
        int position
        text name
        text measures_json
        int checked
    }
```

**Tables owned by Better Auth**: `user`, `session`, `account`, `verification`. We add `is_admin`; everything else stays as the library defines it so upgrades don't fight us.

**Soft references** — every `created_by_id` / `updated_by_id` is nullable with `ON DELETE SET NULL`. Never `CASCADE`. Deleting a user leaves all content intact; the UI renders a removed author as "Deleted user".

**Three reference patterns**, each solving a different ownership question:
- **Soft (`authorRef`)** — nullable, `SET NULL`. For shared content's authorship (`meal`, `plan`, `schedule_entry`): the content must outlive whoever created it.
- **Hard-owned, `CASCADE`** — for genuinely personal data (`shopping_list`): deleting the owner deletes their lists with them.
- **Hard on both sides, `CASCADE`** — for per-user opinions layered on shared content (`meal_pin`, `plan_pin`): meaningless without either the user or the meal/plan, but the pin's own lifecycle never touches the shared content itself. `meal_tag` follows the same shape for a meal/tag pairing.

**Content deletion** *does* cascade where it should: deleting a meal removes its ingredients, steps, image row, tag associations and pins. Deleting a plan removes its items and pins. Deleting a meal referenced by plans or schedule entries prompts for confirmation and names the references.

**`meal.image_hash` is denormalised on purpose** — it lets list views build a cache-busting image URL without joining or touching `meal_image` at all.

**Servings is display-only.** It appears on the recipe card as a reference ("Serves 4") and is deliberately excluded from shopping list maths (§6).

**A plan has no tags of its own.** Its displayed tags are the deduped union of its meals' tags, computed live via a join (`plan_item → meal_tag → tag`) rather than stored — nothing to keep in sync as meals are added, removed or retagged.

**Constraints**
- `meal_ingredient`: `UNIQUE(meal_id, position)`, `quantity > 0`
- `meal_step`: `UNIQUE(meal_id, position)`
- `tag`: `UNIQUE(name)`, case-insensitive de-duplication handled in app code
- `schedule_entry`: `UNIQUE(date, slot, meal_id)` — several meals per slot allowed, same meal twice forbidden
- `plan_item`: `UNIQUE(plan_id, meal_id)`, `UNIQUE(plan_id, position)`
- `meal_image`: `meal_id` is both PK and FK — enforces at most one image per meal
- `shopping_list_item`: `UNIQUE(shopping_list_id, position)`
- `meal_tag` / `meal_pin` / `plan_pin`: composite primary key, no surrogate `id`

**Units** — text, validated in app code against a known set mapped to *dimensions*:

| Dimension | Units | Base |
|---|---|---|
| mass | g, kg, oz, lb | g |
| volume | ml, l, tsp, tbsp, cup | ml |
| count | (none), piece, clove, slice, pinch | piece |

### Registration & bootstrap

Two mechanisms, resolved in order on every sign-up attempt:

| Condition | Behaviour |
|---|---|
| **No users exist yet** | Sign-up allowed **regardless of the flag**. This account becomes admin. |
| `ALLOW_REGISTRATION=true` | Open sign-up. |
| `ALLOW_REGISTRATION=false` | Sign-up requires a valid, unused, unexpired invite code. |

⚠️ **The first rule exists to prevent a lockout.** Without it, deploying with `ALLOW_REGISTRATION=false` on an empty database gives you an app nobody can ever sign into — no users to log in as, and no admin to issue an invite code. Making the very first account unconditional is self-healing and closes the moment it's used.

Invite codes are single-use, expire after a configurable window (default 7 days), and are generated by an admin from Settings. Redemption is atomic — the code is marked used in the same transaction that creates the account, so a shared code can't be redeemed twice concurrently.

**No SMTP means no self-serve password reset.** A forgotten password is resolved by an admin setting a temporary one from Settings, with a forced change on next login. Worth knowing before the only admin forgets theirs — a documented CLI escape hatch (`bun run reset-password <email>`) means a lost admin password doesn't mean a lost database.

---

## 5. Images

### Storage format: BLOB, not base64

Images live **inside the SQLite file** — no separate uploads volume, one thing to back up. But stored as raw `BLOB` rather than base64 `TEXT`:

- Base64 inflates every image by **33%** — our ~110MB of images becomes ~147MB for no benefit.
- It costs an encode on write and a decode on every read.
- Base64 is a *transport* format (for `data:` URIs), not a storage format. We serve over HTTP, so we never need it.

### Separate table, always

`meal_image` is its own table so that `SELECT … FROM meal` for the list view **never reads image bytes**. Putting BLOBs in the `meal` row would make browsing the meal list drag hundreds of MB through SQLite's page cache. This is the single most important decision for perceived speed on mobile.

### Upload pipeline (`sharp`, server-side)

1. Accept **multipart FormData** — not base64. Encoding client-side would inflate 2MB to 2.7MB and push further past the body limit.
2. Reject over **2MB** before processing.
3. **Validate magic bytes**, not the declared MIME type — the client controls the latter.
4. **Auto-rotate** per EXIF orientation, or phone photos land sideways.
5. **Strip all EXIF metadata.** Phone photos of your own kitchen carry **GPS coordinates of your home**. On a shared, wiki-editable app that's a real leak, and it's free to prevent.
6. Resize to fit **1200×1200**, encode **WebP q80** → typically 80–250KB.
7. Generate a **400×400 thumbnail**, WebP q70 → ~15–30KB, for list and calendar views.
8. Store both, plus a content hash.

So the 2MB cap is an *upload* limit; what lands in the database is roughly a tenth of that.

### Serving & caching

A route handler at `/api/meals/[id]/image` (with `?v=<hash>` and a `?size=thumb|full` param) returns the BLOB with:

```
Cache-Control: public, max-age=31536000, immutable
ETag: <content hash>
```

Because the URL carries the content hash, it changes only when the image does. **The browser caches each image permanently and never re-requests it** — the most effective possible fix for image load speed, since it eliminates the request entirely rather than making it faster. Editing an image changes the hash, which changes the URL, which busts the cache automatically.

### Required config

```ts
// next.config.ts
serverActions: { bodySizeLimit: '3mb' }  // 2MB file + multipart overhead + fields
```

Without this, uploads fail at Next's 1MB default.

---

## 6. Shopping list algorithm

Runs on demand. Two entry points: a Plan, or a Schedule date range.

1. **Collect** — resolve in-scope meals, then all their `meal_ingredient` rows.
2. **Normalise** — trim and case-fold the name; convert quantity to its dimension's base unit.
3. **Group** — by `(normalised_name, dimension)` and sum.
4. **Present** — convert back to something human (1200 g → 1.2 kg), rounded to 2dp.
5. **Don't fake it** — `2 onions` and `200 g onions` share a name but not a dimension. They're listed as **separate lines under one heading**, never silently merged; guessing an onion's mass would produce a quietly wrong list.

**Servings are ignored here** by design — quantities are taken exactly as entered on the meal.

The rendered list is **read-only per item** by default: no tick-boxes, no stored state. It offers **Copy to clipboard** (plain text, grouped by dimension) and, on mobile, the **Web Share API**, so it can go straight to Messages/WhatsApp/Notes without ever touching the database.

It can also be **saved** — a deliberate, later exception to "never stored" (`lib/shopping-lists/`). Saving snapshots the current projection into `shopping_list`/`shopping_list_item` rows owned by the saving user (`ON DELETE CASCADE`, unlike every other user reference in this schema — see §1), and hands off to a page where items can be checked off (auto-saving on toggle), renamed, or manually added to/removed from. It's a frozen copy: saving the same Plan or range again creates an independent second list rather than updating the first.

Unit conversion is the fiddliest logic in the app and the likeliest source of subtle bugs, so it ships as a pure, exhaustively unit-tested module with no DB dependency.

---

## 7. Design direction

- **Palette**: warm neutral base (Tailwind `stone`) rather than cold grey; **herb green** primary (`oklch(0.62 0.13 155)`); **warm amber** secondary for accents and the today-marker; red reserved strictly for destructive actions.
- **Dark mode**: first-class. Tokens defined once in `globals.css` under `@theme` for both schemes — no `dark:` sprawl through components.
- **Type**: Geist Sans (already wired), generous line-height, `text-base` minimum on mobile.
- **Shape**: `rounded-2xl` cards, soft shadows, generous padding. Airy rather than dense.
- **Imagery**: meal cards lead with the thumbnail; a deterministic colour-block fallback (seeded from the meal name) keeps grids from looking broken when an image is missing.
- **Components**: **shadcn/ui** (Radix + cva) for accessible bones — dialogs, sheets, selects — restyled to the palette.
- **Icons**: lucide-react.

### Navigation *(confirmed)*

- **Mobile**: bottom app bar — `Home · Meals · Plans · Schedule · ➕`. Settings lives in the **top bar** via an avatar menu.
- **➕** opens a bottom sheet → *New meal · New plan · Schedule a meal*.
- **Desktop**: persistent left sidebar; the bottom bar is mobile-only.
- Touch targets ≥44px; the bar respects `env(safe-area-inset-bottom)` for iOS home-indicator devices.

---

## 8. Engineering notes

Lessons and decisions that don't fit neatly under one of the sections above, kept because the reasoning isn't obvious from the code alone.

- **The auth singleton connects lazily, on first use, not at module import.** An earlier version opened the database connection with a top-level `await`; Next's build imports every route module across many parallel workers, so they raced to open the same file and the build failed. `getAuth()` defers the connection until a request actually needs it.
- **Admin password reset doesn't use Better Auth's admin plugin.** That plugin brings its own `role` column, which would leave two competing answers to "is this user an admin?" alongside the existing `isAdmin`. The temporary password is instead hashed with `hashPassword` from `better-auth/crypto` — the same function the credential provider verifies against — and written directly to the account row.
- **A lockout loop was possible after an admin-triggered password reset.** Resetting a password revokes the user's sessions, but their browser keeps the now-stale cookie. The proxy only checks whether a cookie is *present*, so a stale cookie bounced the DAL's 401 page back to `/sign-in`, which bounced again — inescapable. The 401 page now clears the cookie via a Server Action instead of just linking onward.
- **Radix primitives are used directly, not the shadcn CLI.** The CLI is interactive and would generate a large surface shipped unreviewed. Same underlying architecture (Radix + `cva` + `cn`), but hand-written wrappers with full control of the palette. Worth reconsidering only if the component count grows a lot.
- **`new URL("...", import.meta.url)` breaks the standalone build** — the bundler reads it as a module reference it can't resolve. Migration paths are resolved from the working directory instead, with `MIGRATIONS_DIR` overriding it inside the container, where the standalone output layout differs from dev.
- **Playwright cannot launch under Bun on Windows** — the `--remote-debugging-pipe` transport times out. Run browser verification scripts under `node` instead. `networkidle` also never settles reliably with RSC prefetching in dev mode; prefer explicit waits or `domcontentloaded`.

---

## 9. Configuration

All config is environment-driven, validated with zod in a single module at boot. **Invalid values fail fast with a clear message** rather than silently falling back — a mistyped timezone should stop the container, not quietly shift every date by an hour.

| Variable | Values | Default | Purpose |
|---|---|---|---|
| `TZ` | IANA zone | `Europe/London` | Computing "today" / "this week"; rendering timestamps |
| `DATE_FORMAT` | `DD/MM/YYYY` · `MM/DD/YYYY` · `YYYY-MM-DD` | `DD/MM/YYYY` | How dates render |
| `MEASUREMENT_SYSTEM` | `metric` · `imperial` | `metric` | Default units in forms; shopping-list presentation |
| `WEEK_STARTS_ON` | `monday` · `sunday` | `monday` | Calendar grid layout |
| `ALLOW_REGISTRATION` | `true` · `false` | `false` | Open signup vs invite-only (§4) |
| `INVITE_CODE_TTL_DAYS` | integer | `7` | Invite expiry window |
| `DATABASE_PATH` | path | `/data/app.db` | SQLite file location |
| `BETTER_AUTH_SECRET` | random 32+ chars | — | **Required.** Session signing |
| `BETTER_AUTH_URL` | URL | — | **Required.** Public origin |

### Why `TZ` matters even though schedule dates are timezone-free

All **instants are stored UTC**; all **calendar dates are stored zoneless** (§3). Neither depends on `TZ`.

But deciding **which date is "today"** does. A container runs UTC by default, so at 00:30 BST the server still thinks it's the previous day, and Home would show yesterday's dinner. `TZ` fixes that, and Node honours the variable natively — no date library needs separate configuration.

It's also the display zone for instants ("added 2 hours ago"). Both uses are confined to the boundary functions described in §3.

> **Windows dev note.** Git Bash/MSYS does not pass `TZ` through to native child processes — `TZ=x bun run …` arrives as `undefined`, for both bun and node (other variables propagate fine). Set it in `.env` instead, which is loaded straight into `process.env` and bypasses the shell.
>
> This is a shell quirk, not an app bug, and the design is already immune to it: `todayInAppTimeZone()` passes the zone **explicitly** to `Intl.DateTimeFormat`, so it never depends on the *process* timezone being set. Code that relied on ambient `TZ` affecting `new Date()` would silently misbehave here.

### `MEASUREMENT_SYSTEM` is presentation-only

Each `meal_ingredient` row permanently keeps the unit it was entered with. This variable controls only:

1. Which units the ingredient form offers **by default** (both systems are always accepted), and
2. Which system the **shopping list renders in** — aggregation happens in base units either way, so a list can mix sources and still present consistently.

Flipping it converts what you *see*. It never rewrites what is *stored*. Storing a display preference as data would mean a config change silently reinterpreting 200 g as 200 oz.

### Reaching Client Components

These are non-secret, so the validated config object is read server-side in the root layout and passed down through a context provider. Client Components never read `process.env` directly — that keeps a single validated source of truth and avoids `NEXT_PUBLIC_` sprawl.

### Standing assumptions

- There is **no soft delete** — deleting a meal or plan is permanent, guarded by a confirmation naming its references.
- Config is **deployment-wide**, not per-user. If household members ever want individual preferences, these move to a `user_preference` table with env values as the fallback — the config module is the only thing that would need to change.

---

## 10. Deferred

### Ruled out for v1

- **Applying a Plan to the Schedule.** Decided against: Plans stay pure playlists feeding shopping lists, and the Schedule is filled meal by meal. The two features never touch.
- **Redis** — see below. Closed; not building it.

### Redis cache — closed, not planned

Originally raised as a later addition to keep recent recipes in memory and speed up image loading. Discussed and dropped on 2026-08-14 — recorded here so the reasoning survives the decision:

- **SQLite is already in-memory.** It runs in-process, and the OS page cache holds a ~115MB database entirely in RAM after warm-up. Reads are memory-speed with no network hop. Redis would add a **localhost TCP round trip to data that is already in RAM** — plausibly *slower* than the query it replaces.
- **For images, the browser is the right cache.** The immutable-hash strategy in §5 means each image is fetched **once, ever**. Redis still costs a round trip to the server; browser cache costs zero. Nothing server-side can beat a request that never happens.
- **It reverses the §3 decision** — back to two containers, a healthcheck, and startup ordering, for a household app.

Redis earns its place when there are **multiple app instances** sharing session state, cross-instance rate limiting, background job queues, or pub/sub. None apply to a single-instance deployment.

Note these are *coupled* decisions: the multi-instance architecture where Redis pays off is the same one SQLite rules out. Reconsidering Redis means reconsidering §3 first.

**Revisit if**: we ever run more than one app instance, add background jobs, or measurements show a real bottleneck that isn't solved by an index.

### Also parked

- Meal tags / categories and filtering by them
- Recipe import from a URL
- Per-entry servings scaling (servings are display-only for now)
- Multi-household support
