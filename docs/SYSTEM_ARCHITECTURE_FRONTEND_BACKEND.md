# VeriPay Frontend and Backend System Architecture

Date: 2026-10-08

This document explains the full VeriPay system as currently implemented: frontend, backend, login, data model, API flow, local persistence, runtime commands, and the major production gaps that still need to be closed.

## 1. System Summary

VeriPay is currently a local full-stack MVP for a Nigerian social commerce escrow workflow.

The system has two main layers:

```text
Frontend: React + Vite + TypeScript + Tailwind CSS
Backend:  Node.js HTTP server
```

The frontend provides the user interface for:

- Login
- Escrow dashboard
- Seller directory
- Escrow creation
- Payment confirmation flow
- Delivery confirmation
- Dispute filing
- Arbitration decision
- Notifications
- Digital receipts

The backend provides:

- Login and session token creation
- Session verification
- Protected API routes
- Seller data
- Transaction state transitions
- Dispute state transitions
- Notification state updates
- Local JSON persistence

## 2. Runtime Architecture

Local development uses two services:

```text
React/Vite frontend: http://localhost:3001
Node.js backend:     http://localhost:8787
```

The browser talks to the frontend at `localhost:3001`. Frontend API requests use `/api/...`. Vite proxies those requests to the backend at `localhost:8787`.

```text
Browser
  |
  | UI request
  v
Vite frontend server
  |
  | /api proxy
  v
Node.js backend
  |
  | read/write
  v
data/veripay-db.json
```

The proxy is configured in:

```text
vite.config.ts
```

Relevant config:

```ts
server: {
  proxy: {
    '/api': 'http://localhost:8787',
  },
}
```

## 3. Runtime Commands

The main command is:

```bash
npm run dev
```

This runs:

```bash
node scripts/dev.cjs
```

The dev runner starts:

```text
API: node server.cjs
Web: Vite on port 3001
```

Other commands:

```bash
npm run dev:client
npm run dev:api
npm run build
npm run lint
npm run preview
```

`npm run lint` currently runs TypeScript checking:

```bash
tsc --noEmit
```

`npm run build` creates the production frontend build through Vite.

## 4. Key Project Files

### Frontend

```text
src/main.tsx
src/App.tsx
src/api.ts
src/types.ts
src/index.css
src/seedData.ts
```

### Frontend Components

```text
src/components/LoginPanel.tsx
src/components/VeriPayLogo.tsx
src/components/SellerDirectory.tsx
src/components/EscrowWizard.tsx
src/components/DisputeCenter.tsx
src/components/NotificationsPanel.tsx
src/components/DigitalReceipt.tsx
```

### Backend

```text
server.cjs
scripts/dev.cjs
```

### Documentation

```text
docs/IMPLEMENTATION_LOG.md
docs/BACKEND_AND_LOGIN_SETUP.md
docs/SYSTEM_ARCHITECTURE_FRONTEND_BACKEND.md
```

## 5. Frontend System

The frontend is a React application written in TypeScript. The main app controller is:

```text
src/App.tsx
```

`App.tsx` owns the top-level state for:

- Authenticated user
- Authentication check completion
- Transactions
- Notifications
- Active transaction id
- Selected seller
- Active dashboard tab
- Receipt modal
- API status

Important state values:

```ts
authUser: AuthUser | null
authChecked: boolean
transactions: Transaction[]
notifications: Notification[]
activeTxId: string | null
selectedSeller: SellerProfile | null
activeTab: 'pipeline' | 'history' | 'sellers' | 'disputes'
apiStatus: 'connecting' | 'connected' | 'offline' | 'saving'
```

The frontend is no longer an open dashboard. It now checks auth first and shows either:

```text
LoginPanel
```

or:

```text
Authenticated dashboard
```

## 6. Frontend Login Flow

The login UI is implemented in:

```text
src/components/LoginPanel.tsx
```

The login panel includes:

- Phone number input
- Wallet PIN input
- Sign-in button
- Error display
- Demo account buttons
- VeriPay branded intro panel

Demo accounts are shown directly in the login UI:

```text
Buyer:      Femi Adebayo
Seller:     Amara Couture
Arbitrator: VeriPay Operations
```

All demo users currently use PIN:

```text
1234
```

When the user submits login:

1. `LoginPanel` calls `onLogin(phone, password)`.
2. `App.tsx` calls `login()` from `src/api.ts`.
3. `src/api.ts` sends `POST /api/auth/login`.
4. Backend validates phone and PIN.
5. Backend returns `{ token, user }`.
6. Frontend stores token in local storage.
7. Frontend stores user in state.
8. Dashboard becomes visible.

The local storage key is:

```text
veripay_auth_token
```

## 7. Frontend Session Restore

When the app loads:

1. `App.tsx` checks local storage for an existing auth token.
2. If there is no token, login screen is shown.
3. If there is a token, frontend calls `GET /api/auth/me`.
4. If the token is valid, the backend returns the current user.
5. Frontend restores `authUser`.
6. Frontend loads app state through `GET /api/state`.
7. If token validation fails, frontend clears the token and returns to login.

This allows refresh-based session persistence without requiring the user to log in again every time.

## 8. Frontend API Client

The API client is in:

```text
src/api.ts
```

It centralizes HTTP calls and token handling.

Important functions:

```ts
getAuthToken()
setAuthToken(token)
clearAuthToken()
login(phone, password)
loadCurrentUser()
loadVeriPayState()
saveVeriPayState(state)
loadSellers()
createTransaction(txData)
createQrTransaction(sellerId)
payEscrow(transactionId)
confirmDelivery(transactionId)
fileDispute(transactionId, reason, description)
resolveDispute(transactionId, verdict)
markNotificationRead(notificationId)
clearNotifications()
```

Every API request automatically includes:

```text
Authorization: Bearer <token>
```

when a token exists.

## 9. Frontend Dashboard Structure

After login, `App.tsx` renders the authenticated dashboard.

The header shows:

- VeriPay logo
- Signed-in user role
- Signed-in user name
- Escrow vault amount
- Protection rate
- API status
- Sign-out button

The main dashboard uses four tabs:

```text
Active Escrow Pipeline
History & Receipts
Verified Sellers
Dispute Center
```

Each tab maps to one or more components.

## 10. Frontend Components

### LoginPanel

File:

```text
src/components/LoginPanel.tsx
```

Purpose:

- Collect user phone and PIN
- Provide demo login shortcuts
- Display login errors
- Call the parent login handler

### SellerDirectory

File:

```text
src/components/SellerDirectory.tsx
```

Purpose:

- Display verified sellers
- Filter/search sellers
- Start a standard escrow order
- Start a QR checkout order

Current seller list is still imported from `src/seedData.ts` in this component. The backend also exposes `/api/sellers`, so a future improvement is to fully hydrate seller directory data from the backend.

### EscrowWizard

File:

```text
src/components/EscrowWizard.tsx
```

Purpose:

- Create new escrow agreements
- Display active transaction status
- Handle payment action
- Handle delivery confirmation
- Handle dispute filing
- Show transaction timeline and status-specific UI

The component receives action handlers from `App.tsx`. Those handlers call backend endpoints through `src/api.ts`.

### DisputeCenter

File:

```text
src/components/DisputeCenter.tsx
```

Purpose:

- Display disputed transactions
- Show dispute details and evidence
- Show mediated discussion UI
- Resolve a dispute as buyer refund or seller payout

Resolution calls are routed to backend through `resolveDispute()`.

### NotificationsPanel

File:

```text
src/components/NotificationsPanel.tsx
```

Purpose:

- Display transaction notifications
- Mark individual notifications as read
- Clear all notifications

Notification actions now call backend endpoints.

### DigitalReceipt

File:

```text
src/components/DigitalReceipt.tsx
```

Purpose:

- Show a completed transaction receipt
- Support print-style receipt output

### VeriPayLogo

File:

```text
src/components/VeriPayLogo.tsx
```

Purpose:

- Render reusable VeriPay branding.

## 11. Backend System

The backend is implemented in:

```text
server.cjs
```

It is currently a single-file Node.js HTTP server.

It uses:

```js
require('node:http')
require('node:fs/promises')
require('node:path')
require('node:crypto')
```

The backend responsibilities are:

- Serve API responses as JSON
- Validate login credentials
- Issue signed auth tokens
- Verify bearer tokens
- Protect routes
- Read/write the local datastore
- Create transactions
- Update transaction statuses
- Create timeline events
- Create notifications
- Handle dispute decisions

## 12. Backend Data Storage

Data is stored in:

```text
data/veripay-db.json
```

The file is created automatically if it does not exist.

The backend writes:

```ts
{
  notifications: Notification[];
  transactions: Transaction[];
  revision: string;
  updatedAt: string;
}
```

The JSON file is ignored by Git:

```text
data/*.json
```

This is good for local development, but it is not a production database.

## 13. Backend Seed Data

The backend currently contains hardcoded:

- Sellers
- Demo users
- Initial transactions
- Initial notifications

Seller examples:

```text
Amara Couture
Gadget Hub Lagos
Thrift Wonders
Prestige Kicks
```

User examples:

```text
Femi Adebayo - BUYER
Amara Couture - SELLER
VeriPay Operations - ARBITRATOR
```

## 14. Authentication Backend

Login endpoint:

```text
POST /api/auth/login
```

Request body:

```json
{
  "phone": "+234 802 888 7766",
  "password": "1234"
}
```

Successful response:

```json
{
  "token": "signed-token",
  "user": {
    "id": "user-buyer-1",
    "name": "Femi Adebayo",
    "phone": "+234 802 888 7766",
    "role": "BUYER"
  }
}
```

The backend never returns the `password` field. It uses `publicUser()` to strip that value from responses.

## 15. Token Format

The token is made from:

```text
base64url(payload).signature
```

Payload includes:

```text
sub: user id
role: user role
exp: expiration timestamp
```

The signature is generated with:

```text
HMAC SHA-256
```

The secret comes from:

```text
AUTH_SECRET
```

If `AUTH_SECRET` is not set, development falls back to:

```text
veripay-local-dev-secret
```

Token lifetime is currently:

```text
12 hours
```

## 16. Protected Routes

After login, protected API calls require:

```text
Authorization: Bearer <token>
```

The backend verifies:

1. Header exists
2. Token has payload and signature
3. Signature matches
4. Payload can be decoded
5. Token has not expired
6. User still exists

If verification fails, the backend returns:

```json
{
  "error": "Authentication required."
}
```

## 17. Backend API Routes

### Public Routes

```text
GET  /api/health
POST /api/auth/login
```

### Auth Routes

```text
GET /api/auth/me
```

Returns the current authenticated user.

### Seller Routes

```text
GET /api/sellers
```

Returns the backend seller list.

### State Routes

```text
GET /api/state
PUT /api/state
```

`GET /api/state` returns the full local application state.

`PUT /api/state` updates the full state. This route exists as a broad persistence route but should eventually be replaced by more granular domain endpoints only.

### Transaction Routes

```text
GET  /api/transactions
POST /api/transactions
POST /api/transactions/qr
POST /api/transactions/:id/pay
POST /api/transactions/:id/confirm-delivery
POST /api/transactions/:id/dispute
POST /api/transactions/:id/resolve-dispute
```

### Notification Routes

```text
POST   /api/notifications/:id/read
DELETE /api/notifications
```

## 18. Transaction Lifecycle

VeriPay supports these statuses:

```text
DRAFT
PENDING_PAYMENT
PAYMENT_SECURED
DISPATCHED
IN_TRANSIT
DELIVERED
COMPLETED
DISPUTED
REFUNDED
```

Current implemented backend transitions:

```text
Create escrow      -> PENDING_PAYMENT
Pay escrow         -> PAYMENT_SECURED
Confirm delivery   -> COMPLETED
File dispute       -> DISPUTED
Refund buyer       -> REFUNDED
Pay seller verdict -> COMPLETED
```

Some statuses such as `DISPATCHED`, `IN_TRANSIT`, and `DELIVERED` exist in the type model and seed data, but the backend does not yet expose dedicated logistics update endpoints for them.

## 19. Data Model

The main TypeScript model file is:

```text
src/types.ts
```

Core domain entities:

```text
AuthUser
SellerProfile
Transaction
TimelineEvent
Dispute
EvidenceFile
Notification
```

### AuthUser

Represents the signed-in frontend user:

```ts
{
  id: string;
  name: string;
  phone: string;
  role: 'BUYER' | 'SELLER' | 'ARBITRATOR';
}
```

### Transaction

Represents an escrow order:

```ts
{
  id: string;
  productName: string;
  category: string;
  amount: number;
  sellerId: string;
  sellerName: string;
  sellerHandle: string;
  sellerPhone: string;
  buyerName: string;
  buyerPhone: string;
  deliveryPartner: string;
  trackingNumber: string;
  deliveryTimelineDays: number;
  terms: string;
  status: TransactionStatus;
  createdAt: string;
  timeline: TimelineEvent[];
  dispute?: Dispute;
}
```

### Dispute

Represents a formal escrow dispute:

```ts
{
  id: string;
  openedBy: 'BUYER' | 'SELLER';
  reason: string;
  description: string;
  buyerEvidence: EvidenceFile[];
  sellerEvidence: EvidenceFile[];
  arbitrationStatus: 'PENDING' | 'UNDER_REVIEW' | 'BUYER_REFUNDED' | 'SELLER_PAID';
}
```

## 20. End-to-End Data Flow Examples

### Login

```text
User enters phone and PIN
  -> LoginPanel calls App.handleLogin()
  -> App calls api.login()
  -> POST /api/auth/login
  -> Backend validates demo credentials
  -> Backend returns token and public user
  -> Frontend stores token
  -> Frontend renders dashboard
```

### Create Escrow

```text
User selects seller
  -> EscrowWizard form submitted
  -> App.handleCreateTransaction()
  -> api.createTransaction()
  -> POST /api/transactions
  -> Backend creates transaction
  -> Backend creates timeline event
  -> Backend creates notification
  -> Backend writes JSON datastore
  -> Backend returns updated state
  -> Frontend refreshes transaction and notification state
```

### Pay Escrow

```text
User confirms wallet PIN in UI
  -> App.handlePayEscrow()
  -> api.payEscrow()
  -> POST /api/transactions/:id/pay
  -> Backend moves transaction to PAYMENT_SECURED
  -> Backend appends timeline event
  -> Backend creates notification
  -> Frontend refreshes state
```

### File Dispute

```text
User enters dispute reason and description
  -> App.handleTriggerDispute()
  -> api.fileDispute()
  -> POST /api/transactions/:id/dispute
  -> Backend moves transaction to DISPUTED
  -> Backend creates dispute object
  -> Backend appends timeline event
  -> Backend creates notification
  -> Frontend switches to Dispute Center
```

## 21. Current Verification

The following checks have passed:

```bash
npm run lint
npm run build
```

Backend behavior already verified:

```text
POST /api/auth/login returns a token
Authenticated GET /api/state returns 200
```

## 22. Current Strengths

The system now has:

- Real frontend/backend split
- Login-first application flow
- Session restore
- Protected API routes
- Backend-driven transaction actions
- Backend-driven notifications
- Local persistent datastore
- Documented API structure
- GitHub-backed source history

## 23. Current Limitations

This is a local MVP, not a production fintech backend yet.

Important limitations:

- JSON file persistence is not production-safe
- Demo users are hardcoded
- Demo PINs are plain text
- No password hashing
- No real payment provider
- No database migrations
- No role-specific access rules yet
- No automated backend tests
- No request validation library
- No rate limiting
- No audit log table
- No file upload service for dispute evidence
- Seller directory still reads frontend seed data in the UI

## 24. Recommended Production Path

Recommended next engineering steps:

1. Replace `data/veripay-db.json` with PostgreSQL.
2. Add proper user registration and hashed passwords.
3. Enforce role-specific permissions.
4. Move hardcoded sellers/users into database tables.
5. Split `server.cjs` into modules.
6. Add request validation with a schema library.
7. Add automated tests for auth and escrow actions.
8. Add real payment provider integration.
9. Add file upload support for dispute evidence.
10. Add audit logging for every money movement and arbitration decision.
11. Add deployment configuration for frontend and backend.
12. Add environment-specific configuration for secrets, ports, database URLs, and payment keys.

## 25. High-Level Future Architecture

The intended production architecture should become:

```text
Browser
  |
  v
React frontend
  |
  v
API server
  |
  +-- PostgreSQL
  +-- Payment provider
  +-- Object storage for evidence
  +-- Notification service
  +-- Audit logging
```

The current implementation is a good MVP foundation because it already separates user interface actions from backend state transitions. The next phase is replacing local demo infrastructure with production-grade services.
