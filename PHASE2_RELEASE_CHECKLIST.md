# Phase-2 Release Checklist

## 1) Environment
- Ensure `CRON_SECRET` is set in Vercel project env vars.
- Ensure `UPSTASH_REDIS_REST_URL` is set.
- Ensure `UPSTASH_REDIS_REST_TOKEN` is set.
- Ensure `NEXTAUTH_SECRET` and `NEXTAUTH_URL` are correct for production.

## 2) Cron Jobs
- Configure external scheduler jobs (for example `cron-job.org`):
  - `/api/internal/cron/billing-reconcile?limit=120` hourly
  - `/api/internal/cron/billing-events-prune?keepDays=180&batchSize=500` daily
- Validate scheduler requests include `Authorization: Bearer <CRON_SECRET>`.

## 3) Access Controls
- Confirm `/settings/ops` is accessible only to Commercial owners.
- Confirm `/api/ops/*` is blocked for non-commercial/non-owner users.
- Confirm `/api/internal/cron/*` requires bearer token and rejects unauthenticated calls.

## 4) Functional Checks
- Run `npm run lint`.
- Run `npm run test:phase2`.
- Verify cron visibility:
  - `/settings/ops` shows runs and job summaries.
  - Sidebar shows 24h failure badge for Commercial owners when failures exist.

## 5) Data Safety
- Confirm billing reconcile runs in `dryRun=1` mode manually once before first live cycle.
- Confirm prune endpoint in `dryRun=1` before enabling scheduled deletion.

## 6) Monitoring
- Watch first 24 hours of cron run outcomes via Ops Monitor.
- Investigate any failure spikes and check `CronRun.error` payloads.
