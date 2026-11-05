# Host VeriPay on Render

The production project has a Node service named `veripay-api` in Oregon and a
static site named `veripay`. The Node backend also serves the built React app
from `dist/` at the same origin as `/api`.

## Deploy

1. Deploy the intended GitHub branch to the existing `veripay-api` service.
2. Use Node.js 24. Build with `npm ci --include=dev && npm run build` and start
   with `npm start`. Check `/api/health` after deployment.
3. Set the server's `DATABASE_URL` to its Supabase/PostgreSQL connection URL.
   The server uses it for accounts, orders, credentials and uploaded files.
   `/api/health` should report `storage.engine: postgres`. Without that URL,
   the app uses local SQLite, which requires a persistent disk on Render.
4. Set `VERIPAY_DEMO_PASSWORD` to a private password of 10–128 characters to
   enable seeded sign-in. The seeded admin email is `tunde.risk@veripay.ng`.
5. Set `AI_PROVIDER=rules` for the built-in responses. To use a hosted model,
   see `docs/AI_LAYER.md` for the Anthropic and OpenRouter configuration.

Payments use sandbox funds. Review Render's displayed charges before changing
any service's compute plan or storage allocation.

## Demo retest

1. Check `/api/health` for healthy PostgreSQL storage and sandbox payments. Verify
   the configured storage path and variable names in Render without exposing values.
2. Open Demo accounts on the sign-in page or check `/api/auth/demo-accounts`.
   Confirm `enabled: true` and sign in as buyer, seller, and reviewer (admin).
3. Verify the exact purchase total and check the AI source and model version
   for the configured provider. Inspect internal dispute recommendations as a reviewer.
4. For a registered test account, request recovery at `/forgot-password`. In
   Admin Control, review the recovery request, verify the owner, and issue a
   recovery code. Use **Forgot password?** to redeem it. Confirm the old
   password and prior session fail. Keep the recovery code out of screenshots.
5. Check the login, checkout and role workspaces at 390px and inspect Render logs.
6. Open `/getting-started`, switch between buyer and seller guides, and register
   an account. Confirm its guide appears, continue to the workspace, then sign
   out and back in with the same credentials. Recovery is administrator-assisted;
   the app does not send reset emails.

## Persistence and restarts

With `DATABASE_URL`, domain records and password hashes live in PostgreSQL.
Private documents and product images are stored in its `file_blobs` repository.
The backend uses database transactions and immutable audit, purchase and ledger
seals. Row-level security blocks direct browser access. Sessions remain in
memory, so a deployment may require signing in again with the existing password.

For an existing SQLite deployment, migrate its data before switching storage.
Files already lost with an ephemeral Render instance cannot be recovered by
enabling PostgreSQL. Local SQLite accounts are not copied automatically.

For PostgreSQL, use your database provider's backups or `pg_dump`. The existing
`npm run db:backup` command operates on local SQLite only.

## Request origins

Use the same HTTPS address for the frontend and API. The origin guard supports
TLS terminating at Render's proxy while retaining the public Host header.
If another proxy rewrites Host, set `VERIPAY_PUBLIC_ORIGIN` to the exact public
origin, such as `https://veripay.example.com` (no path or trailing query).
Redeploy after environment changes.

## References

- https://render.com/docs/blueprint-spec
- https://render.com/docs/disks
- https://render.com/docs/deploy-node-express-app
