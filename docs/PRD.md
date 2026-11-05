# VeriPay product requirements

Status: Draft for product and engineering review · 4 November 2026

## Problem and audience

Buyers and sellers in online commerce need a shared record of what was purchased, when payment was held, and whether delivery took place. Reviewers need enough evidence to resolve claims consistently. The sandbox serves Nigerian buyers, storefront operators and VeriPay reviewers using simulated funds.

## Goals and scope

- Let buyers discover real listings and review exact purchase terms before paying.
- Record purchase, payment and delivery events so reviewers can resolve disputes with traceable evidence.
- Give buyers and sellers a clear account status and a way to challenge trust decisions.
- Keep financial and account decisions with authorized services or reviewers. AI provides advice and reviewers can override it.

Live money movement, automated dispute settlements, automated trust penalties, SMS recovery and independent courier integrations are outside this release.

## User stories and acceptance criteria

| Feature | User story | Acceptance criteria |
| --- | --- | --- |
| F1 · AI shopping | As a buyer, I want to ask a question in plain language and find relevant listings. | Returned product IDs resolve to visible catalog entries. Product cards show catalog prices. The response identifies AI or keyword search. Provider failure still returns keyword results. |
| F2 · Purchase confirmation and evidence | As a buyer, I want to check the exact agreement before paying. | The prompt opens with the confirmation question and shows product, variant, quantity, unit price, seller, delivery terms and the total including escrow fees. The API identifies Claude or rules guidance. Explicit confirmation seals a timestamped, hashed snapshot of the agreement before payment. |
| F3 · AI-assisted disputes | As a reviewer, I want to see the case timeline and gaps before deciding. | The reviewer can inspect the purchase snapshot, evidence and delivery records together. The recommendation includes provenance, confidence, rationale, inconsistencies and suggested evidence requests where relevant. Parties cannot see the internal recommendation. Only an authorized reviewer can record a decision and reason. The audit trail captures the recommendation, decision and whether the reviewer followed it. |
| F4 · Risk detection | As a reviewer, I want unusual activity and linked identities surfaced for investigation. | Rules create reviewable flags with reasons. Reviewers can resolve or dismiss flags. Account restrictions or adverse trust changes require reviewer approval and an audit entry. |
| F5 · Trust Passport 2.0 | As a buyer or seller, I want to understand the trust information used in the marketplace and challenge it if needed. | The passport displays the current level and relevant indicators. Eligible users can submit a challenge. Reviewers record the outcome and reason, and users can see the resulting status. |
| F6 · Dispatch verification | As a seller, I want to record who is handling delivery so a claim can be checked later. | The order requires rider or logistics contact details before dispatch. Authorized users can record delivery verification. Evidence and status history are available to the reviewer on disputed orders. |

## Demo access and release checks

- The sandbox host shares the configured demo password privately. The sign-in screen lists the buyer, seller and reviewer email addresses. Verify successful sign-in and the correct workspace for each role.
- At 390px, verify the login logo, favicon, workspace navigation, checkout, recovery and reviewer views. Check the browser for failed application requests.
- A registered buyer or seller can use a verified administrator-issued code to set a new password. Codes expire, can be used once and are rate limited. The public reset form does not look up email addresses. The new password works and prior sessions are revoked.
- Complete a synthetic order from discovery through confirmation, sandbox payment, dispatch and delivery. Use a separate eligible order to open a dispute. Capture sanitized responses showing AI provenance and inspect Render logs for errors.

## Success measures

Proposed sandbox targets for product sign-off:

- Three of three seeded roles can sign in and reach the correct workspace.
- Every confirmed test purchase has an intact evidence snapshot before payment. Every resolved test dispute has a reviewer rationale.
- Every controlled catalog test returns valid IDs and correct displayed prices. Every forced provider outage preserves the core workflow through fallbacks.
- Track time from dispute opening to reviewer decision, recommendation acceptance and overrides, fallback rates, and completion of the checkout and recovery flows. Set pilot targets after collecting a baseline.

## Risks and open decisions

- Model output can be wrong or unavailable. Keep amounts and transaction state authoritative on the server, show provenance, and sample recommendations against reviewer decisions.
- Dispute evidence can contain personal information. Use synthetic cases in demo tests and establish retention and provider data-handling policies before a pilot.
- Shared demo credentials and manual recovery depend on operator controls. Restrict distribution of credentials and recovery codes, and agree on how reviewers verify account ownership.
- Delivery records can conflict or be incomplete. Reviewers need access to the underlying evidence and a way to request more information.
- Product and operations still need to confirm pilot thresholds, evidence retention, and reviewer response targets.
