# Host VeriPay on Render

The production project has a Node service named `veripay-api` in Oregon and a
static site named `veripay`. The Node backend also serves the built React app
from `dist/` at the same origin as `/api`.

## Deploy

1. Deploy the intended GitHub branch to the existing `veripay-api` service.
2. Use Node.js 24. Build with `npm ci --include=dev && npm run build` and start
   with `npm start`. Check `/api/health` after deployment.
3. Retain the API's configured database and upload paths. Keep persistent files
   on a mounted disk if using SQLite. Use one API instance for this setup.
4. Set `VERIPAY_DEMO_PASSWORD` to a private password of 10–128 characters to
   enable seeded sign-in. The seeded admin email is `tunde.risk@veripay.ng`.
5. Set `AI_PROVIDER=rules` for the built-in responses. To use a hosted model,
   see `docs/AI_LAYER.md` for the Anthropic and OpenRouter configuration.

Payments use sandbox funds. Review Render's displayed charges before changing
any service's compute plan or storage allocation.

## Demo retest

1. Check `/api/health` for healthy SQLite storage and sandbox payments. Verify
   the configured storage path and variable names in Render without exposing values.
2. Open Demo accounts on the sign-in page or check `/api/auth/demo-accounts`.
   Confirm `enabled: true` and sign in as buyer, seller, and reviewer (admin).
3. Verify the exact purchase total and check the AI source and model version
   for the configured provider. Inspect internal dispute recommendations as a reviewer.
4. For a registered test account, open its admin profile, verify its owner, and
   issue a recovery code. Use **Forgot password?** to redeem it. Confirm the old
   password and prior session fail. Keep the recovery code out of screenshots.
5. Check the login, checkout and role workspaces at 390px and inspect Render logs.

## Persistence and restarts

SQLite, verification documents and product images live under the persistent
`/var/data/veripay` mount. Use one service instance because the app uses SQLite
and in-memory sessions. Deployments and restarts require users to sign in again.
New deployments start with seeded data unless an existing database is restored;
local accounts and uploads are not automatically copied to the hosted service.

For backups, use `npm run db:backup` in the service shell and download the result
to separate storage; also back up uploaded files and verification documents.

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
