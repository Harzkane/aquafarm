# Security Notes

## Authentication
- NextAuth credentials flow with bcrypt password verification.
- Sessions are JWT-based.
- Session payload carries:
  - Owner tenant id (`id`)
  - Actor id (`memberUserId`)
  - Role and plan metadata

## Authorization
- Defense in depth:
  - Middleware route-level gating
  - API-level role/plan checks
- Role model:
  - `owner`
  - `staff`
- Commercial-owner-only surfaces include:
  - Staff management
  - Operational audit visibility
  - Ops monitor endpoints/pages

## Multi-Tenant Isolation
- Core documents include owner `userId`.
- Staff operates inside owner scope through session mapping.
- APIs query with owner-scoped filters.

## Rate Limiting
- Middleware write/auth limits:
  - Auth endpoints: tighter threshold
  - Write API endpoints: broader threshold
- Primary backend:
  - Upstash Redis REST distributed counters
- Fallback:
  - In-memory buckets if Redis is unavailable

## Billing Integrity
- Paystack webhook signature verification (`x-paystack-signature`).
- Event idempotency using `BillingEvent.eventKey`.
- Reconcile endpoint to repair drifted billing state.

## Cron Endpoint Protection
- Internal cron routes require `CRON_SECRET` bearer token.
- Do not expose `CRON_SECRET` client-side.

## Sensitive Data Handling
- Keep secrets only in runtime env vars.
- Never commit `.env.local`.
- Rotate exposed credentials immediately if leaked.

## HTTP Hardening Headers
Middleware sets:
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`
- `Cross-Origin-Opener-Policy`
- `Cross-Origin-Resource-Policy`

## Current Gaps / Future Hardening
- Add centralized alerting on repeated cron failures.
- Add integration tests for authz and sensitive route behavior.
- Consider Redis-only mode in production (disable memory fallback if strict consistency required).

