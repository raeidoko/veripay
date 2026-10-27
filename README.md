# VeriPay

Brand assets, colour palette, 4K exports, and the image restoration prompt are
documented in [docs/BRANDING.md](docs/BRANDING.md).

AI-assisted e-commerce and escrow demo with a product catalog, seller storefronts,
purchase confirmation, dispatch verification, disputes, risk review, trust
passports, and an audit trail.

## Run locally

Requires Node.js 24+ (tested with 24.14.1), including its built-in SQLite module.

```powershell
npm install
npm run dev
```

Open http://localhost:3001. The web app and API share the same server.
Set PORT to use a different port.

The AI layer uses Dots3-Note Preview through OpenRouter when a server-side
`OPENROUTER_API_KEY` is configured. Missing keys, failed requests and invalid output
use built-in rules. Purchase confirmations use exact order facts; dispute advice
still requires human review. See [AI layer setup](docs/AI_LAYER.md) for configuration.
No local model download or Docker service is required.

## Verify and serve a build

```powershell
npm run lint
npm run build
npm run test:personas
npm run test:backend
npm start
```

npm start serves the built web app and API together. npm run preview previews
only the static frontend; use npm start for working API routes.

## Demo behavior

Sign in with an email address and password. Accounts open their buyer, seller, or admin workspace.
Payments use a sandbox wallet and ledger. Orders, inventory, purchase snapshots, disputes, reviews, risk decisions, trust records, credentials, and administration metadata persist together in SQLite at `data/governance/veripay.sqlite`. Existing governance JSON files are imported on first database creation. The previous project's data in `backups/` has not been migrated.

Buyers can add test funds from the Orders workspace. Seeded buyers start with ₦10 million in simulated funds; new accounts start with zero and must be approved before topping up or trading. Each order belongs to one seller. See [Backend implementation and operations](docs/BACKEND.md) for the structure, API, database checks, backups, and remaining production work.

Each account opens its role's workspace:

| Role | Features |
| --- | --- |
| Buyer | Shopping assistant, product ratings and reviews, cart, own purchases, delivery confirmation, own disputes and trust passport |
| Seller | Own storefront and listings, customer orders, courier registration and dispatch, own disputes and trust passport |
| Admin | Control Centre, user approvals and suspension, private document review, product and review moderation, platform settings, disputes, risk, transactions, trust registry and audit trail |

The API derives role permissions and record ownership from an opaque, server-side
session. Sessions use HttpOnly, SameSite cookies, expire after eight hours, and are
revoked by Sign out. Account selection headers and browser localStorage cannot
change the signed-in identity. Cross-site writes are rejected and repeated failed
sign-ins are rate limited. Buyer and seller disputes remain limited to their orders.

### Local demo sign-in

| Account | Email |
| --- | --- |
| Buyer | amara.okafor@example.com |
| Seller | contact@lagosluxuryhub.ng |
| Admin | tunde.risk@veripay.ng |

The local demo password is **VeriPay123!**. The sign-in page's Local demo accounts
section can fill these credentials. Set VERIPAY_DEMO_PASSWORD in the server's .env
to override the password for all seeded accounts; the override is never exposed by
the demo account endpoint. Credentials are hashed with a separate salt per account.
New users click Register on VeriPay, then select Buyer or Seller within the form and register with their
name (or store name), Nigerian phone number, email, and their own password of at
least 10 characters. Registration signs them in and opens Verification. New accounts
start pending and cannot trade until an admin approves an identity document and
the account. Admin registration is not available. Accounts and salted password
hashes are saved in the SQLite accounts repository; the demo password override
does not affect newly registered users. Email delivery and password recovery are
not implemented.
Sessions are in memory, so restarting the server requires signing in again.

Buyers can add a 1–5 star rating and comment before or after purchasing, and update
their own review. Each buyer has one review per product. Catalog averages and counts
come from submitted reviews, rather than the supplied demo totals. Reviews use the
same transactional SQLite storage as orders and survive server restarts.

Sellers can upload a JPG, PNG, or WebP image (up to 5 MB) when publishing a
product, preview it, and replace images on their existing listings with
Change image. Uploaded files are saved in `data/uploads/products/` and served
by both development and production servers. The files survive restarts; product
records are saved in the governance store. Uploads are excluded from Git.

## Administration

See [Admin Control Centre](docs/ADMIN_CONTROL.md) for approval and moderation workflows.

## Previous version

The previous working files, including local data and the old package lock,
are preserved in backups/veripay-before-replacement-20261022-105058/.
Git history remains in the existing repository. Dependencies can be restored with
the backed-up package manifest and lock file. Backups are excluded from Git.
