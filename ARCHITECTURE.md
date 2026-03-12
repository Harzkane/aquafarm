# Architecture

## Stack
- Frontend: Next.js 14 App Router + React 18
- Backend: Next.js route handlers (`app/api/**`)
- Database: MongoDB (Mongoose models)
- Auth: NextAuth credentials provider + JWT session
- Billing: Paystack integration
- Runtime controls:
  - Middleware security and access gates
  - Upstash REST-backed rate limiting in middleware
  - External scheduler calls for background maintenance

## High-Level Modules
- UI pages:
  - Auth pages under `app/(auth)`
  - Product pages under `app/(dashboard)`
- API routes:
  - Domain CRUD and actions under `app/api/**`
- Core libraries:
  - Auth/session (`lib/auth.ts`)
  - DB connection (`lib/db.ts`)
  - Plans/entitlements (`lib/plans.ts`)
  - Billing reconcile logic (`lib/billing-reconcile.ts`)
  - Alert rules and synchronization (`lib/alerts.ts`)
  - Cron helpers (`lib/cron-*`)
  - Atomic write helper (`lib/transactions.ts`)
  - Payload validators (`lib/validators/*`)
- Data models:
  - `User`, `Batch`, `Tank`, `DailyLog`, `Financial`, `FeedInventory`
  - `TankMovement`, `CalendarEvent`, `AuditLog`, `BillingEvent`, `CronRun`, `AlertNotification`

## Data Ownership Model (Multi-Tenancy)
- Owners are tenant roots.
- Staff users reference owner via `farmOwnerId`.
- Session maps staff into owner scope:
  - `session.user.id` => owner id
  - `session.user.memberUserId` => actual actor id
- Core data is scoped by owner id (`userId` fields on documents).

## Access Control Model
- Middleware performs early gating:
  - Free-plan locked modules
  - Commercial-owner-only modules (`/settings/staff`, `/settings/audit`, `/settings/ops`, `/api/ops`, etc.)
  - Staff restrictions (for example billing settings access)
- API routes enforce additional server-side checks.

## Billing Architecture
- Checkout:
  - `/api/billing/checkout` initializes Paystack transaction
- Confirmation:
  - `/api/billing/verify` verifies reference on callback path
  - `/api/billing/webhook` processes provider webhook events
- State controls:
  - `/api/billing/status`
  - `/api/billing/cancel`
  - `/api/billing/reconcile` (owner-triggered consistency fix)
- Idempotency:
  - `BillingEvent` tracks processed event keys

## Background Jobs
- External scheduler triggers:
  - Hourly billing reconcile
  - Daily billing-event prune
  - Periodic alert evaluation (`alerts-evaluate`)
- Internal cron routes (`/api/internal/cron/*`) protected by `CRON_SECRET`.
- `CronRun` model stores run summaries and failures.

## Alerting Architecture
- Alert data model:
  - `AlertNotification` stores deduped active/resolved alerts per owner scope.
- Rule evaluation:
  - `collectAlertCandidates(userId)` derives candidates from logs, batches, milestones, feed, billing, and ops status.
  - `syncAlertsForUser(userId, candidates)` upserts active alerts and resolves stale keys.
- Access:
  - `GET /api/alerts` for in-app alert feed.
  - `POST /api/alerts/:id/ack` to dismiss an alert.
- Scheduling:
  - `/api/internal/cron/alerts-evaluate` updates alerts in bounded batches for Vercel-safe execution.

## Transaction Strategy
- Critical multi-document writes use `runAtomic`:
  - Supports Mongo transactions when available
  - Falls back for environments without replica-set transactions
- Applied to high-risk flows:
  - Daily log create/update with mortality side effects
  - Daily log delete with mortality rollback
  - Tank movements across tanks + batch allocations + movement log
  - Harvest revenue write + optional batch harvest state update

## Observability Surface
- Owner-facing ops APIs:
  - `/api/ops/cron-runs`
  - `/api/ops/cron-health`
- Ops UI:
  - `/settings/ops`
- Sidebar shows 24-hour cron failure alert for Commercial owners.
