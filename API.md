# API Reference (Current)

All routes are under `app/api/**`.

## Auth
- `POST /api/auth/register`
  - Register owner account
- `GET|POST /api/auth/[...nextauth]`
  - NextAuth handlers

## Farm Operations
- Batches:
  - `GET|POST /api/batches`
  - `PATCH|DELETE /api/batches/:id`
- Tanks:
  - `GET|POST /api/tanks`
  - `PATCH|DELETE /api/tanks/:id`
  - `GET|POST /api/tanks/movements`
- Daily Logs:
  - `GET|POST /api/logs`
  - `PATCH|DELETE /api/logs/:id`
- Water Quality:
  - `GET|POST /api/water-quality`
- Feed Inventory:
  - `GET|POST|PATCH /api/feed-inventory`
  - `PATCH|DELETE /api/feed-inventory/entries/:id`
- Financials:
  - `GET|POST /api/financials`
  - `PATCH|DELETE /api/financials/entries/:id`
- Harvest:
  - `GET|POST /api/harvest`
- Calendar:
  - `GET|POST /api/calendar/events`
  - `DELETE /api/calendar/events/:id`
- Reports:
  - `GET /api/reports/summary`
  - `GET /api/reports/export`

## SaaS / Billing
- `POST /api/billing/checkout`
- `POST /api/billing/verify`
- `POST /api/billing/webhook`
- `GET /api/billing/status`
- `POST /api/billing/cancel`
- `POST /api/billing/reconcile`
- `POST /api/billing/success-program`

## Team and Audit
- Staff:
  - `GET|POST /api/staff`
  - `DELETE /api/staff/:id`
- Audit:
  - `GET /api/audit`

## Ops Observability (Owner-facing)
- `GET /api/ops/cron-runs`
- `GET /api/ops/cron-health`

## Internal Cron (Token-protected)
Requires:
- `Authorization: Bearer <CRON_SECRET>`

Routes:
- `POST /api/internal/cron/billing-reconcile`
  - Query:
    - `dryRun=1` optional
    - `limit` (1..200)
- `POST /api/internal/cron/billing-events-prune`
  - Query:
    - `dryRun=1` optional
    - `keepDays` (30..730)
    - `batchSize` (50..1000)
- `GET /api/internal/cron/runs`
  - Query:
    - `job` optional
    - `status=success|failed` optional
    - `limit` (1..200)

## Error Pattern
Typical response:
- `{ "error": "message" }` with appropriate HTTP status.

Plan/permission lock pattern:
- `{ "error": "...", "code": "PLAN_FEATURE_LOCKED" }`

