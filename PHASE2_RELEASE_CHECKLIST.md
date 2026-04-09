# Phase 2 Release Checklist

## Current Status
- Checklist updated on 2026-04-10.
- Local verification completed for code enforcement, `npm run lint`, and `npm run test:phase2`.
- Remaining items are production-only checks that require Vercel env review or first-live-run observation.

## 1) Environment
- [ ] Ensure `CRON_SECRET` is set in Vercel project env vars.
- [ ] Ensure `UPSTASH_REDIS_REST_URL` is set.
- [ ] Ensure `UPSTASH_REDIS_REST_TOKEN` is set.
- [ ] Ensure `NEXTAUTH_SECRET` and `NEXTAUTH_URL` are correct for production.

Notes:
- Redis env vars are referenced in [middleware.ts](/Users/harz/Downloads/aquafarm/middleware.ts).
- `NEXTAUTH_SECRET` is used in auth and middleware at [lib/auth.ts](/Users/harz/Downloads/aquafarm/lib/auth.ts) and [middleware.ts](/Users/harz/Downloads/aquafarm/middleware.ts).
- `NEXTAUTH_URL` is used in billing flows at [app/api/billing/checkout/route.ts](/Users/harz/Downloads/aquafarm/app/api/billing/checkout/route.ts).

## 2) Cron Jobs
- [ ] Configure external scheduler jobs.
- [ ] `/api/internal/cron/billing-reconcile?limit=120` hourly.
- [ ] `/api/internal/cron/billing-events-prune?keepDays=180&batchSize=500` daily.
- [x] Validate scheduler requests include `Authorization: Bearer <CRON_SECRET>`.

Notes:
- Bearer-token enforcement exists in:
  - [app/api/internal/cron/billing-reconcile/route.ts](/Users/harz/Downloads/aquafarm/app/api/internal/cron/billing-reconcile/route.ts)
  - [app/api/internal/cron/billing-events-prune/route.ts](/Users/harz/Downloads/aquafarm/app/api/internal/cron/billing-events-prune/route.ts)
  - [app/api/internal/cron/alerts-evaluate/route.ts](/Users/harz/Downloads/aquafarm/app/api/internal/cron/alerts-evaluate/route.ts)
  - [app/api/internal/cron/alerts-dispatch/route.ts](/Users/harz/Downloads/aquafarm/app/api/internal/cron/alerts-dispatch/route.ts)
  - [app/api/internal/cron/runs/route.ts](/Users/harz/Downloads/aquafarm/app/api/internal/cron/runs/route.ts)
- `npm run test:phase2` passed the cron auth test.

## 3) Access Controls
- [x] Confirm `/settings/ops` is accessible only to Commercial owners.
- [x] Confirm `/api/ops/*` is blocked for non-commercial/non-owner users.
- [x] Confirm `/api/internal/cron/*` requires bearer token and rejects unauthenticated calls.

Notes:
- Page-level commercial owner gating exists in [middleware.ts](/Users/harz/Downloads/aquafarm/middleware.ts) for `/settings/ops`.
- API gating exists in:
  - [app/api/ops/cron-health/route.ts](/Users/harz/Downloads/aquafarm/app/api/ops/cron-health/route.ts)
  - [app/api/ops/cron-runs/route.ts](/Users/harz/Downloads/aquafarm/app/api/ops/cron-runs/route.ts)
- Commercial-owner-only route families in middleware currently include:
  - `/settings/staff`
  - `/settings/audit`
  - `/settings/ops`

## 4) Functional Checks
- [x] Run `npm run lint`.
- [x] Run `npm run test:phase2`.
- [ ] Verify cron visibility in browser on a Commercial owner account.
- [ ] `/settings/ops` shows runs and job summaries.
- [ ] Sidebar shows 24h failure badge for Commercial owners when failures exist.

Notes:
- `npm run lint` passes with 2 pre-existing warnings only:
  - [app/(dashboard)/settings/audit/page.tsx#L71](/Users/harz/Downloads/aquafarm/app/(dashboard)/settings/audit/page.tsx#L71)
  - [app/(dashboard)/settings/ops/page.tsx#L97](/Users/harz/Downloads/aquafarm/app/(dashboard)/settings/ops/page.tsx#L97)
- `npm run test:phase2` passed 14/14 tests.
- Browser verification is still needed for the actual Commercial-owner experience.

## 5) Data Safety
- [ ] Confirm billing reconcile runs in `dryRun=1` mode manually once before first live cycle.
- [ ] Confirm prune endpoint in `dryRun=1` before enabling scheduled deletion.

Notes:
- These should be treated as release-blocking production checks.
- Do not schedule live deletion or live reconcile before the dry-run responses look correct.

## 6) Monitoring
- [ ] Watch first 24 hours of cron run outcomes via Ops Monitor.
- [ ] Investigate any failure spikes and check `CronRun.error` payloads.

Notes:
- Ops monitor surfaces are in:
  - [app/(dashboard)/settings/ops/page.tsx](/Users/harz/Downloads/aquafarm/app/(dashboard)/settings/ops/page.tsx)
  - [app/api/ops/cron-runs/route.ts](/Users/harz/Downloads/aquafarm/app/api/ops/cron-runs/route.ts)
  - [app/api/ops/cron-health/route.ts](/Users/harz/Downloads/aquafarm/app/api/ops/cron-health/route.ts)

## Suggested Release Order
1. Confirm Vercel env vars.
2. Run billing reconcile with `dryRun=1`.
3. Run prune with `dryRun=1`.
4. Configure scheduler jobs with bearer token.
5. Verify `/settings/ops` and sidebar visibility on a Commercial owner account.
6. Watch first 24 hours of cron outcomes.

## Local Verification Summary
- `npm run lint`: passed with 2 existing hook warnings.
- `npm run test:phase2`: passed all 14 tests.
- Access-control enforcement found in middleware and protected API routes.
- Production env and first-live-run checks are still pending.
