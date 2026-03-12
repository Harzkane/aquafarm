# AquaFarm

AquaFarm is a production-ready aquafarm management and planning SaaS platform built with Next.js and MongoDB.

It combines farm operations, planning workflows, financial visibility, and SaaS controls in one workspace.

## Current Product Status
- Platform stage: Production-capable SaaS (Phase-2 hardening implemented)
- Core domain coverage: Operations + planning + billing + team controls + ops visibility
- Runtime: Vercel (external scheduler for cron endpoints)

## Core Capabilities
- Farm operations:
  - Batches, tanks, daily logs, mortality, water quality, feed inventory, harvest
- Planning:
  - Calendar milestones and playbook/SOP guidance
- Commercials:
  - Financial tracking, report summaries, CSV export
- SaaS controls:
  - Plan tiers (`free`, `pro`, `commercial`)
  - Paystack billing flows (checkout, verify, webhook, cancel)
  - Billing reconciliation controls
  - Commercial staff management and operational audit logs
- Operations and reliability:
  - Distributed middleware rate limiting (Upstash REST with local fallback)
  - Protected internal cron jobs for billing reconcile and retention prune
  - Centralized alert evaluation and notification feed
  - Cron run logging and owner-facing Ops Monitor (`/settings/ops`)

## Plan Tiers (Implemented)
- `free`
  - Max active batches: `1`
  - Max tanks: `4`
  - Report history: `30 days`
  - No staff seats
- `pro` (Pro Founder)
  - Max active batches: `5`
  - Unlimited tanks
  - Full report history
  - No staff seats
- `commercial` (Pro+ Commercial)
  - Unlimited active batches
  - Unlimited tanks
  - Staff seats: `5`
  - Commercial owner-only ops surfaces (`staff`, `audit`, `ops`)

## Tech Stack
| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), React 18 |
| Styling | Tailwind CSS |
| Backend | Next.js Route Handlers |
| Database | MongoDB (Mongoose) |
| Auth | NextAuth Credentials + JWT session |
| Billing | Paystack |
| Runtime Ops | External scheduler + Upstash Redis REST |

## Quick Start (Local)

### 1) Install dependencies
```bash
npm install
```

### 2) Configure environment
```bash
cp .env.local.example .env.local
```

Minimum required for local app usage:
```env
MONGODB_URI=...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000
```

Optional but required for full SaaS behavior:
- Billing: `PAYSTACK_*`
- Distributed rate limiting: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- Internal cron auth: `CRON_SECRET`

### 3) Run the app
```bash
npm run dev
```

Open `http://localhost:3000`.

## Quality Commands
- Lint:
```bash
npm run lint
```
- Phase-2 logic tests:
```bash
npm run test:phase2
```

## Deploy (Vercel)

### Required production env vars
- Core:
  - `MONGODB_URI`
  - `NEXTAUTH_SECRET`
  - `NEXTAUTH_URL`
- Billing:
  - `PAYSTACK_SECRET_KEY`
  - `PAYSTACK_WEBHOOK_SECRET`
  - `PAYSTACK_PRO_AMOUNT_KOBO`
  - `PAYSTACK_COMMERCIAL_AMOUNT_KOBO`
- Rate limiting:
  - `UPSTASH_REDIS_REST_URL`
  - `UPSTASH_REDIS_REST_TOKEN`
- Internal cron security:
  - `CRON_SECRET`

### Scheduled jobs (external scheduler)
Use an external scheduler (for example `cron-job.org`) to call:
- `POST /api/internal/cron/billing-reconcile?limit=120`
- `POST /api/internal/cron/billing-events-prune?keepDays=180&batchSize=500`
- `POST /api/internal/cron/alerts-evaluate?limit=50`
- `POST /api/internal/cron/alerts-dispatch?limit=50`

Include header:
- `Authorization: Bearer <CRON_SECRET>`

Optional outbound alert env (WhatsApp):
- Direct Meta Cloud mode (recommended):
  - `ALERT_WHATSAPP_PROVIDER=meta_cloud`
  - `WHATSAPP_CLOUD_PHONE_NUMBER_ID`
  - `WHATSAPP_CLOUD_ACCESS_TOKEN`
- Webhook relay mode (optional):
  - `ALERT_WHATSAPP_WEBHOOK_URL`
  - `ALERT_WHATSAPP_WEBHOOK_TOKEN`
- Shared:
  - `ALERTS_WHATSAPP_TO`
  - `ALERT_OUTBOUND_COOLDOWN_MINUTES`

## Project Structure
```bash
aquafarm/
├── app/
│   ├── (auth)/login/
│   ├── (dashboard)/...
│   └── api/
│       ├── auth/
│       ├── billing/
│       ├── batches/
│       ├── logs/
│       ├── water-quality/
│       ├── tanks/
│       ├── harvest/
│       ├── financials/
│       ├── feed-inventory/
│       ├── calendar/events/
│       ├── reports/
│       ├── alerts/
│       ├── staff/
│       ├── audit/
│       ├── ops/
│       └── internal/cron/
├── components/
├── lib/
├── models/
├── tests/phase2/
└── app/globals.css
```

## Documentation Index
- `PRODUCT.md` — Product scope and module map
- `ARCHITECTURE.md` — System architecture and flow design
- `API.md` — API route reference
- `OPERATIONS.md` — Runbooks, cron ops, and maintenance
- `SECURITY.md` — Authz, rate limiting, and secrets handling
- `CONTRIBUTING.md` — Local setup and contribution workflow
- `PHASE2_RELEASE_CHECKLIST.md` — Production rollout checklist

## Alerts and Notifications
- In-app alerts page: `/alerts`
- Alert categories currently covered:
  - Operations and planning: no daily log, overdue milestones, harvest window, feed low stock
  - Health: mortality spike, water quality risk
  - SaaS controls: billing risk (`past_due`, expiry, scheduled downgrade), staff seat pressure
  - Ops reliability: cron failures (commercial owners)
- Alert feed APIs:
  - `GET /api/alerts` (active alerts)
  - `GET /api/alerts?counts=1` (active counts by severity)
  - `GET /api/alerts?refresh=1` (recompute + sync for current farm)
  - `POST /api/alerts/:id/ack` (dismiss one alert)
- Outbound dispatch:
  - `POST /api/internal/cron/alerts-dispatch` (critical alerts to WhatsApp webhook adapter with cooldown)
