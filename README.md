# api-kamomi

Rewrite of the Kamomi backend (Spring Boot) in **Fastify 5 + TypeScript + Drizzle ORM**. The API contract is kept
compatible with the Astro frontend (`http://localhost:4321`).

## Running

```bash
pnpm install
cp .env.example .env      # fill in DB_URL etc. (the old JDBC URL format is still accepted)
pnpm dev                  # tsx watch
pnpm test                 # Vitest + PGlite (in-process Postgres, no Docker / real DB needed)
pnpm typecheck && pnpm lint && pnpm build && pnpm start
pnpm seed                 # roles, FAQ, menus (idempotent). Equivalent to `--seed` in the Java version
```

Every server start runs `runBootstrap` (subscription plans + the "Panduan Fasilitas" menu), same as
`DataInitializer` in Java.

### Connection pool

The Postgres pool defaults to `DB_POOL_MAX=5` and `DB_POOL_MIN=0` so that dev hot reloads (and other apps sharing
the same database) don't exhaust `max_connections`. Raise `DB_POOL_MAX` in production according to your Postgres
`max_connections` and the number of running instances.

## Architecture

Each module under `src/modules/<name>/` is layered as **route → controller → service → repository**:

| Layer | File | Responsibility |
|---|---|---|
| Routes | `*.routes.ts` | Zod schemas, rate limits, and wiring handlers to paths. Also the composition root: `Repository → Service → Controller`. |
| Controller | `*.controller.ts` | HTTP concerns: authorization (`authorize`, property/room access), reading the request, wrapping responses in the `{success, code, message, data}` envelope. |
| Service | `*.service.ts` | Business rules, validation, DTO mapping, notifications. Never talks to Drizzle directly. |
| Repository | `*.repository.ts` | All database queries (Drizzle). Extends `BaseRepository`, which provides `transaction(fn)` so services can run a unit of work against a transaction-bound repository. |

Notes:

- Inside `repo.transaction(async (tx) => ...)`, use only `tx` (and repositories built from it). A query issued through
  another repository while the transaction is open waits for the same connection (it hangs on PGlite's single connection).
- Shared helpers: `AccessGuard` (`properties/access.ts`, tenant isolation), `SubscriptionPolicy`
  (`subscriptions/subscription-policy.ts`, plan permissions and suspension), `authorize` (`users/authz.ts`, role checks).
- `content/` (rules, facility guides, contacts) uses a generic `ScopedCrud*` repository/service/controller assembled by
  `registerScopedCrud`; each entity is only configuration in `content.routes.ts`.

## Database

- All tables live in the Postgres schema **`kamomi`** (not `public`).
- `drizzle/0000_*.sql` is the **baseline** migration generated from the Drizzle schema (plain `CREATE TABLE`).
  **Do not run it against a DB that already contains tables from the Java version.** The existing DB is used as-is;
  the migration is only for empty/new DBs and as a reference. Mark the baseline as applied before using
  `db:migrate` on an existing DB.
- Verify the schema against a real DB: `node --env-file=.env node_modules/drizzle-kit/bin.cjs pull`
  (needs `schemaFilter: ['kamomi']`, already set in `drizzle.config.ts`), then compare with `src/db/schema`.

## Compatibility with the Java version

Preserved: the `{success, code, message, data, errors}` envelope; HTTP 200 with `code` 201 on create;
Spring-style Page JSON (`content`, `totalElements`, ...); jsonb as **JSON text** (`features`, `oldData`, `newData`);
JWT HS256/384/512 chosen by secret length with subject = email (old tokens stay valid); BCrypt hashes;
public room codes (AES-128/ECB, `HashUtil`); `?token=` for SSE; public endpoints (`/api/public/**`) wrap
errors in HTTP 200.

## Intentional differences (security fixes / bug fixes)

| Area | Java | Here |
|---|---|---|
| Tenant isolation | Any `ADMIN` can read/modify any property & room | Must be a member of the property in `property_users` (`modules/properties/access.ts`); SUPER_ADMIN unrestricted |
| `/api/roles` | No role check | ADMIN/SUPER_ADMIN |
| `/api/menus/user/{id}/sidebar`, `/user-overrides` | No check | Sidebar: self/admin; override: admin |
| Rules on a room | Rules from other properties allowed | Only rules from the same property |
| Staff assignment when creating a room | Any user | Property members only |
| Password reset code | `java.util.Random` | `crypto.randomInt` |
| `IllegalArgumentException` errors | HTTP 500 | HTTP 400 (message in `message` and `errors`) |
| Deleting data still referenced (FK) | 500 | 409 |
| No token | Empty 403 | 401 with envelope |
| `createdBy/updatedBy` on plans | Full User entity (including password hash) | `{id, name, email}` |
| Rate limiting | None | login/register/forgot/reset, public complaints, public rooms |

## Notes

- Java's `DataInitializer` overwrites subscription plans with default values **on every start**; this behavior is kept,
  so price changes made by a SUPER_ADMIN revert to the defaults on restart.
- The seed of 100 "Seed Rule" entries for Property ID=2 (pagination test data) is not ported.
- Set `TRUST_PROXY=true` when running behind a reverse proxy so rate limiting and IP logging use the real client IP.
