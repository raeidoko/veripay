# VeriPay local backend

The local backend preserves the React app's existing API, TypeScript domain types,
email/password login, and HttpOnly session cookies. It adopts the supplied backend's
separation of routes, services, database access, middleware, and utilities.

## Structure

```text
server.ts                        HTTP bootstrap, authentication, file serving, errors
src/server/config.ts             Port and storage configuration
src/server/personaAccess.ts      Roles, record ownership and account approval gates
src/server/routes/               Catalog, orders, disputes, risk, trust and wallet routers
src/server/controlRoutes.ts      Verification documents, moderation and administration
src/server/services/            Domain rules, sandbox ledger and optional AI
src/server/db/store.ts           Typed collections and initial demo data
src/server/db/persistence.ts     SQLite repository, migrations and request transactions
src/server/utils/                Hashing and input validation
scripts/database.ts              Integrity checking, reconciliation and backups
```

Node.js 24+ is required. No separate database service or new dependency installation
is needed. Run `npm run dev` and visit http://localhost:3001. For a production-mode
local build, run `npm run build` followed by `npm start`.

## Persistence and migration

The default database is `data/governance/veripay.sqlite`. `VERIPAY_ADMIN_DATA_DIR`
changes the governance directory; `VERIPAY_DB_PATH` overrides just the database file.
Existing `accounts.json` and `state.json` are imported when the corresponding
repositories do not exist. Existing product images and verification files retain
their paths. Legacy JSON files are then read-only migration sources, not active
storage. Old files in `backups/` are not automatically imported.

The repository stores domain collections as JSON documents in SQLite. All domain
changes in an API request commit in one transaction before a success response.
Failed requests and failed commits restore the in-memory model and roll back the
database. Requests are serialized because services share mutable typed objects;
reads cannot observe an unfinished payment or dispute decision. SQLite uses WAL
and full synchronous commits. Each request reloads persisted state after acquiring
the write transaction. Session cookies and rate-limit counters remain in memory;
users sign in again after restart.

Audit entries, purchase snapshots and ledger movements have independent sealed
tables with SQL triggers rejecting updates and deletes. Commits reject altered or
removed sealed records. Snapshot SHA-256 checks cover the purchase payload and,
for new purchases, the server's confirmation text and explicit buyer response.
Existing illustrative demo snapshots receive actual payload hashes when a fresh
database is first initialized.

Uploaded image and verification bytes live on disk outside the database. A failed
metadata transaction can leave an unreferenced upload; it cannot authorize access
to a verification document. Public file serving blocks the database and private
governance paths, including in development.

## Order and money rules

- Orders require an approved, unrestricted buyer, a delivery address, positive
  integer quantities, available products and valid variants from one seller.
- Confirmation requires `buyerResponse: "YES_CONFIRMED"`. The server seals its
  own agreement, rather than trusting confirmation text sent by the browser.
- Only a confirmed order awaiting payment can be funded. Payment checks the
  snapshot, seller availability and aggregate stock, then debits the sandbox
  wallet, holds escrow and decrements stock atomically.
- Concurrent or repeated payments cannot debit funds or stock twice. Dispatch
  requires funded escrow and a valid rider/company contact. Dispatch stores the
  expected delivery date.
- Delivery confirmation releases the seller subtotal and platform fee exactly
  once. Active funded orders can enter a dispute; this blocks normal delivery
  settlement. Only staff can decide a dispute, with a valid outcome and rationale.
- A buyer refund returns the full held amount. A seller ruling pays the subtotal
  and platform fee. A split divides the held amount 50/50 between buyer and seller,
  rounding the buyer share down to a whole kobo and charging no platform fee.
- Risk-hold release restores the appropriate confirmation/payment stage; it never
  manufactures a funded payment. New registrations register hashed phone/device
  attributes for identity-link review.

API money values remain in naira for frontend compatibility. Wallet balances,
escrow holds and immutable ledger movements use integer kobo. Seeded buyers receive
₦10 million in sandbox opening funds. Existing funded demo orders have explicit
sandbox opening-escrow entries. Newly registered users receive no initial funds.

`VERIPAY_SANDBOX_PAYMENTS=true` is the local default. Set it to `false` to reject
top-ups and new payments. This does not enable a real payment provider. The UI
labels test funds, and `GET /api/health` reports `sandbox` or `unconfigured`.

## API additions

All routes except health require the existing session cookie and ownership/role
checks. Existing frontend routes and response formats remain available.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Storage readiness and payment mode; no credentials or file paths |
| GET | `/api/wallet` | Signed-in user's available funds and held escrow |
| POST | `/api/wallet/topup` | Approved buyer adds simulated funds: `{ "amount": 100000 }` |
| GET | `/api/wallet/ledger` | Own transaction movements; staff can see all movements |
| GET | `/api/orders/:id/snapshot` | Sealed purchase snapshot with `intact` hash check |
| GET | `/api/orders/:id/receipt` | Settled order, snapshot and ledger movements |
| POST | `/api/disputes/:id/analyze` | Staff reruns advisory analysis on an active case |
| POST | `/api/disputes/:id/info-requests` | Staff asks `{ "requestedFrom": "BUYER", "question": "..." }` |

Buyer and seller dispute responses omit the private AI recommendation. Decisions
remain human actions. Automated calls/SMS are not configured; delivery verification
accepts recorded reviewer phone calls. Gemini is optional, with a request timeout
and rule-based fallbacks. Set `GEMINI_API_KEY` and optionally `GEMINI_MODEL` to use
the model available to your account.

## Verification and backups

```powershell
npm run lint
npm run build
npm test
npm run db:check
npm run db:backup
```

Start the app once before the maintenance commands so the database is initialized.
`db:check` checks SQLite integrity, snapshot hashes, immutable seals and complete
wallet/escrow ledger reconciliation. `db:backup` first checks the source and then
uses SQLite `VACUUM INTO` to create a consistent standalone database snapshot,
including committed WAL data. It refuses to overwrite an existing destination.
An explicit destination can be supplied:

```powershell
npm run db:backup -- backups/veripay-before-change.sqlite
```

Also back up `data/governance/documents/` and `data/uploads/products/` (or their
configured locations): database backups contain metadata, not uploaded file bytes.
To test a restore, stop the app, keep the original database, and point
`VERIPAY_DB_PATH` at a copy of the backup. Keep document/upload directories in place.

Integration tests use temporary databases. They cover existing role/ownership and
administration flows, invalid checkout, concurrent payments/decisions, stock,
refunds/splits, rollback after an injected database failure, SQL immutability,
interrupted uploads, restart recovery, backup restore and disabled sandbox payments.

## Remaining production work

This finishes the local sandbox backend. PostgreSQL/Supabase is deferred as requested;
it is not connected or implemented as a storage adapter yet. The SQLite document
repository and serialized request model are intended for local use. A PostgreSQL
migration should introduce normalized tables, transactional repositories, row locks,
versioned migrations and shared session/rate-limit storage before multiple instances
or public deployment.

Real payments still need a provider integration, authenticated and idempotent payment
webhooks, settlement reconciliation and provider failure handling. Identity-provider
checks, email delivery/password recovery, automated SMS/calls, background deadline
jobs, appeals scheduling and production deployment configuration remain separate
integrations. Sandbox identity decisions and wallet credits do not perform those
external operations.
