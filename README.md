# VeriPay

VeriPay is a polished escrow workflow platform for Nigerian social commerce. It helps buyers, sellers, logistics teams, and dispute mediators manage a protected payment flow from agreement creation to delivery confirmation, settlement, or refund.

## What is included

- Verified seller directory with trust signals and QR-style checkout starts
- Escrow agreement creation, OPay-style wallet funding, and delivery tracking
- Buyer, seller, logistics, and dispute-resolution workflow views
- Dispute center with evidence, mediated discussion, and arbitration decisions
- Digital receipt modal with print support

## Project documentation

- [Implementation log](docs/IMPLEMENTATION_LOG.md)
- [Backend and login setup](docs/BACKEND_AND_LOGIN_SETUP.md)
- [Frontend and backend system architecture](docs/SYSTEM_ARCHITECTURE_FRONTEND_BACKEND.md)
- [Frontend and backend system architecture DOCX](docs/VeriPay_Frontend_Backend_System_Architecture.docx)

## Run locally

Prerequisites: Node.js 20 or newer.

```bash
npm install
npm run dev
```

The app runs at `http://localhost:3001`. The local Node.js API runs at `http://localhost:8787` and is proxied through Vite under `/api`.

## Node.js backend

The backend is a dependency-light Node.js HTTP server in `server.cjs`. It persists local development data to `data/veripay-db.json`, which is ignored by Git so real working data is not committed by accident.

Demo sign-in accounts use PIN `1234`:

- Buyer: `+234 802 888 7766`
- Seller: `+234 803 111 2222`
- Arbitrator: `+234 800 000 0000`

Current API surface:

- `GET /api/health`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/sellers`
- `GET /api/transactions`
- `GET /api/state`
- `POST /api/transactions`
- `POST /api/transactions/qr`
- `POST /api/transactions/:id/pay`
- `POST /api/transactions/:id/confirm-delivery`
- `POST /api/transactions/:id/dispute`
- `POST /api/transactions/:id/resolve-dispute`
- `POST /api/notifications/:id/read`
- `DELETE /api/notifications`

## Quality checks

```bash
npm run lint
npm run build
```
