# AI layer setup

VeriPay uses Dots3-Note Preview through OpenRouter for product search and advisory
dispute analysis. No local model download or Docker service is needed.

## Configuration

Set these values in the server's ignored `.env`, then restart the server:

```dotenv
AI_PROVIDER=openrouter
OPENROUTER_API_KEY="your-key-here"
OPENROUTER_MODEL="dots-studio/dots-3-note-preview:free"
```

The default model is Dots3. Missing keys use rules immediately. Set
`AI_PROVIDER=rules` to disable remote requests. Credentials stay on the server;
never put them in browser code or VITE_ variables. Starting the server alone
does not make a model request. Old local-model settings are not used.

## Data and behavior

The backend sends shopper queries and catalog fields (IDs, names, shortened
descriptions, prices and currencies), or dispute facts (claim details, purchase
snapshot, delivery verification records and submitted text evidence), to
OpenRouter and its serving provider. Images are not fetched or interpreted by
this text-only integration. Evidence URLs may appear in the supplied records.

Purchase confirmations remain deterministic and contain exact order facts.
Model instructions treat shopper/seller/buyer text as untrusted input. Generated
text must pass runtime validation. Search IDs must exist in the current catalog.
Dispute outputs use an outcome allowlist, finite bounded confidence, capped
text/lists and buyer/seller question recipients. Recommendations record the
actual model or built-in rules used.

The adapter in `src/server/services/openRouterProvider.ts` uses HTTPS bearer
authentication, separate system/user messages and JSON output. No alternative
model fallback is configured. The shared AI layer aborts after 20 seconds and
uses rules for connection failures, authentication/rate limits, empty replies,
truncated output, refusals or invalid JSON shapes. Upstream bodies and credentials
are not logged. Runtime validation checks structure, not factual truth.

Dispute recommendations never move funds. NEEDS_REVIEW cannot settle funds.
Reviewers explicitly choose a settlement outcome and write their rationale.
Suggested questions are displayed for reviewers, not automatically sent.
Historical recommendations keep their original provenance.

## Preview availability

As checked on October 27, 2026, OpenRouter lists this model as free with rate limits
and marks it as going away on December 31, 2026. Recheck availability before
production and set OPENROUTER_MODEL to a chosen replacement when necessary.
If the model becomes unavailable, the app continues with rules.

Sources: [Dots3 model listing](https://openrouter.ai/dots-studio/dots-3-note-preview:free),
[OpenRouter API](https://openrouter.ai/docs/api/reference/overview).

## Verification

Run `npm test`, `npm run lint` and `npm run build`. Provider tests mock network
responses; test servers explicitly use rules even if a local API key exists.
Live checks should use synthetic data rather than real disputes.
