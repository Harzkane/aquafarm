# Operations Guide

## Deployment Runtime
- Hosting: Vercel
- Build/runtime: Next.js App Router
- DB: MongoDB Atlas
- External services:
  - Paystack (billing)
  - Upstash Redis REST (rate limiting)

## Required Environment Variables
- Core:
  - `MONGODB_URI`
  - `NEXTAUTH_SECRET`
  - `NEXTAUTH_URL`
- Billing:
  - `PAYSTACK_SECRET_KEY`
  - `PAYSTACK_WEBHOOK_SECRET`
  - `PAYSTACK_PRO_AMOUNT_KOBO`
  - `PAYSTACK_COMMERCIAL_AMOUNT_KOBO`
- Middleware rate limiting:
  - `UPSTASH_REDIS_REST_URL`
  - `UPSTASH_REDIS_REST_TOKEN`
- Internal cron security:
  - `CRON_SECRET`
- Optional support links:
  - `NEXT_PUBLIC_COMMUNITY_SUPPORT_URL`
  - `NEXT_PUBLIC_WHATSAPP_PRIORITY_NUMBER`
  - `NEXT_PUBLIC_WHATSAPP_PRIORITY_MESSAGE_PRO`
  - `NEXT_PUBLIC_WHATSAPP_PRIORITY_MESSAGE_COMMERCIAL`
  - `NEXT_PUBLIC_COMMERCIAL_ONBOARDING_URL`
  - `NEXT_PUBLIC_COMMERCIAL_CHECKIN_URL`

## Scheduled Jobs
Configured in `vercel.json`:
- Hourly reconcile:
  - `GET/POST /api/internal/cron/billing-reconcile?limit=120`
- Daily retention prune:
  - `GET/POST /api/internal/cron/billing-events-prune?keepDays=180&batchSize=500`

Note:
- Internal cron routes require header:
  - `Authorization: Bearer <CRON_SECRET>`

## Manual Runbook (Safe Mode First)
1. Reconcile dry run:
   - Call `/api/internal/cron/billing-reconcile?dryRun=1&limit=100`
2. Prune dry run:
   - Call `/api/internal/cron/billing-events-prune?dryRun=1&keepDays=180&batchSize=200`
3. Validate outputs:
   - Check `/settings/ops` or `/api/ops/cron-runs`
4. Run live once if dry run is healthy.

## Ops Monitoring
- UI:
  - `/settings/ops` (Commercial owner only)
- API:
  - `/api/ops/cron-runs?limit=...`
  - `/api/ops/cron-health?hours=24`

Key indicators:
- Failed runs in last 24h
- Last failure timestamp and job
- Run durations
- Candidate/updated counts for reconcile
- Deleted counts for prune

## Incident Triage
If cron failures appear:
1. Confirm `CRON_SECRET` and authorization header behavior.
2. Check MongoDB availability and write permissions.
3. Check query bounds (`limit`, `batchSize`) are not overly high.
4. Review failure details from `CronRun.error`.
5. Re-run job with `dryRun=1` before resuming live runs.

## Data Retention
- `BillingEvent` prune is batched and bounded.
- Adjust via query params:
  - `keepDays` (min 30, max 730)
  - `batchSize` (min 50, max 1000)

