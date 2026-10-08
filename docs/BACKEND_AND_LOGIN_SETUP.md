# VeriPay Backend and Login Setup

Date: 2026-10-08

This document explains the backend and login work completed for VeriPay. It focuses specifically on the Node.js API, local persistence, authentication flow, protected routes, and the frontend login panel.

## Backend Overview

VeriPay now has a local Node.js backend in:

```text
server.cjs
```

The backend runs on:

```text
http://localhost:8787
```

The frontend runs on:

```text
http://localhost:3001
```

During local development, Vite proxies frontend `/api` requests to the backend. That proxy is configured in:

```text
vite.config.ts
```

The backend currently uses Node.js built-in modules only:

```text
http
fs/promises
path
crypto
```

No Express or database framework has been added yet. This keeps the first backend version simple while still giving the app real API routes, auth protection, and persistent local state.

## Dev Command

The main local command is:

```bash
npm run dev
```

This runs:

```text
node scripts/dev.cjs
```

The dev script starts both services:

```text
API server: server.cjs on port 8787
Vite app:   Vite on port 3001
```

## Local Persistence

The backend persists local development data to:

```text
data/veripay-db.json
```

This datastore is created automatically when the backend first needs it.

The file is ignored by Git:

```text
data/*.json
```

This protects local transaction and notification data from being pushed to GitHub accidentally.

The backend reads and writes the following main state shape:

```ts
{
  transactions: Transaction[];
  notifications: Notification[];
  revision?: string;
  updatedAt?: string;
}
```

## Seeded Backend Data

The backend includes seeded seller profiles:

```text
Amara Couture
Gadget Hub Lagos
Thrift Wonders
Prestige Kicks
```

It also includes seeded demo users for login:

```text
Buyer:      Femi Adebayo
Seller:     Amara Couture
Arbitrator: VeriPay Operations
```

Initial transaction and notification data are also defined in `server.cjs`. If `data/veripay-db.json` does not exist, the backend writes the initial state to disk.

## API Routes

### Public Routes

These routes do not require authentication:

```text
GET  /api/health
POST /api/auth/login
```

`GET /api/health` confirms the backend is running.

`POST /api/auth/login` accepts phone and PIN credentials and returns a signed session token.

### Authenticated Routes

All other app routes require a valid bearer token:

```text
GET    /api/auth/me
GET    /api/sellers
GET    /api/transactions
GET    /api/state
PUT    /api/state
POST   /api/transactions
POST   /api/transactions/qr
POST   /api/transactions/:id/pay
POST   /api/transactions/:id/confirm-delivery
POST   /api/transactions/:id/dispute
POST   /api/transactions/:id/resolve-dispute
POST   /api/notifications/:id/read
DELETE /api/notifications
```

Requests to protected routes must include:

```text
Authorization: Bearer <token>
```

If the token is missing, invalid, or expired, the backend returns:

```json
{ "error": "Authentication required." }
```

## Login Setup

Login is implemented with demo phone numbers and a shared demo PIN.

Demo PIN:

```text
1234
```

Demo users:

```text
Buyer:      +234 802 888 7766
Seller:     +234 803 111 2222
Arbitrator: +234 800 000 0000
```

The backend keeps these demo users in the `users` array in `server.cjs`.

Each user has:

```ts
{
  id: string;
  name: string;
  phone: string;
  role: 'BUYER' | 'SELLER' | 'ARBITRATOR';
  password: string;
}
```

The password field is currently a demo PIN. It is not production-safe and should later be replaced with hashed passwords.

## Token Creation

After successful login, the backend creates a signed token.

The token contains:

```text
sub: user id
role: user role
exp: 12-hour expiration timestamp
```

The backend signs the token with HMAC SHA-256 using:

```text
AUTH_SECRET
```

If no environment secret is provided, local development falls back to:

```text
veripay-local-dev-secret
```

For production, `AUTH_SECRET` must be set from a secure environment variable.

## Token Verification

For protected routes, the backend:

1. Reads the `Authorization` header.
2. Extracts the bearer token.
3. Verifies the HMAC signature.
4. Decodes the claims.
5. Checks token expiration.
6. Finds the matching user.
7. Rejects the request if any step fails.

This logic is handled by:

```text
verifyToken()
getAuthUser()
requireAuth()
```

## Frontend API Client

The frontend API client lives in:

```text
src/api.ts
```

It handles:

- Saving the auth token to local storage
- Loading the auth token from local storage
- Clearing the auth token on sign-out
- Sending `Authorization: Bearer <token>` with API calls
- Calling auth, transaction, dispute, seller, and notification endpoints

The auth token key is:

```text
veripay_auth_token
```

## Login Panel UI

The login panel lives in:

```text
src/components/LoginPanel.tsx
```

The login panel includes:

- Phone number input
- Wallet PIN input
- Secure sign-in button
- Error message for invalid login
- Demo account selector for Buyer, Seller, and Arbitrator
- Branded VeriPay login layout

The demo selector fills the phone number and PIN automatically for quick testing.

## App Session Flow

The main session logic is in:

```text
src/App.tsx
```

The app now follows this flow:

1. On load, check whether a token exists in local storage.
2. If there is no token, show the login panel.
3. If a token exists, call `GET /api/auth/me`.
4. If the token is valid, restore the user session.
5. Load VeriPay state from `GET /api/state`.
6. Show the dashboard.
7. If token restore fails, clear the token and show login.

The dashboard header now shows:

- Signed-in user's role
- Signed-in user's name
- API status
- Sign-out button

## Backend Product Actions

The following product actions now happen through the backend:

```text
Create escrow
Create QR checkout escrow
Pay escrow
Confirm delivery
File dispute
Resolve dispute
Mark notification as read
Clear notifications
```

This means the frontend no longer relies on browser-only state for these flows. The backend updates the JSON datastore and returns the updated app state.

## Transaction Flow Endpoints

### Create Escrow

```text
POST /api/transactions
```

Requires product name, positive amount, and terms.

Creates a new transaction with:

```text
PENDING_PAYMENT
```

It also adds an initial timeline event and notification.

### QR Checkout

```text
POST /api/transactions/qr
```

Requires seller id.

Creates a prefilled escrow transaction for that seller and adds a QR scan timeline event.

### Pay Escrow

```text
POST /api/transactions/:id/pay
```

Moves the transaction to:

```text
PAYMENT_SECURED
```

It also adds a timeline event and payment notification.

### Confirm Delivery

```text
POST /api/transactions/:id/confirm-delivery
```

Moves the transaction to:

```text
COMPLETED
```

It adds a funds-release timeline event and completion notification.

### File Dispute

```text
POST /api/transactions/:id/dispute
```

Requires:

```text
reason
description
```

Moves the transaction to:

```text
DISPUTED
```

It creates a dispute object, adds buyer evidence placeholder data, appends a timeline event, and sends a dispute notification.

### Resolve Dispute

```text
POST /api/transactions/:id/resolve-dispute
```

Accepts:

```text
BUYER_REFUNDED
SELLER_PAID
```

`BUYER_REFUNDED` moves the transaction to:

```text
REFUNDED
```

`SELLER_PAID` moves the transaction to:

```text
COMPLETED
```

The backend updates the dispute verdict, appends a timeline event, and sends a resolution notification.

## Notification Endpoints

Mark notification as read:

```text
POST /api/notifications/:id/read
```

Clear all notifications:

```text
DELETE /api/notifications
```

Both routes update the local JSON datastore and return the updated state.

## Verification Performed

The following project checks passed:

```bash
npm run lint
npm run build
```

Backend checks performed:

```text
POST /api/auth/login returned a signed token
Authenticated GET /api/state returned 200
```

## Current Limitations

The backend is functional for local MVP development, but still needs production hardening.

Current limitations:

- Demo users are hardcoded in `server.cjs`
- Demo PINs are stored in plain text
- Token secret has a local fallback
- JSON file storage is not suitable for production concurrency
- Role-specific authorization rules are not fully enforced yet
- There is no rate limiting
- There is no request schema validation library
- There are no automated backend tests yet
- Dispute evidence upload is placeholder data
- Payment provider integration is simulated

## Recommended Backend Next Steps

1. Move users, sellers, transactions, disputes, and notifications into PostgreSQL.
2. Add password hashing with `bcrypt` or `argon2`.
3. Require `AUTH_SECRET` in production.
4. Split `server.cjs` into routers, services, auth utilities, and datastore modules.
5. Add role-specific authorization for Buyer, Seller, and Arbitrator workflows.
6. Add validation schemas for request bodies.
7. Add API tests for auth and escrow workflows.
8. Replace simulated payment actions with a real payment provider integration.
9. Add audit logs for payment, dispute, refund, and payout decisions.
10. Add secure file upload for dispute evidence.
