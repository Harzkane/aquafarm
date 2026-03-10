# AquaFarm

AquaFarm is a production-ready aquafarm management and planning SaaS platform built with Next.js and MongoDB.

It combines farm operations, planning workflows, financial visibility, and SaaS controls in one workspace.

## Current Product Status
- Platform stage: Production-capable SaaS (Phase-2 hardening implemented)
- Core domain coverage: Operations + planning + billing + team controls + ops visibility
- Runtime: Vercel (with scheduled cron jobs)

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
| Runtime Ops | Vercel Cron + Upstash Redis REST |

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

### Cron jobs
`vercel.json` defines:
- Hourly billing reconcile:
  - `/api/internal/cron/billing-reconcile?limit=120`
- Daily billing-event prune:
  - `/api/internal/cron/billing-events-prune?keepDays=180&batchSize=500`

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
│       ├── staff/
│       ├── audit/
│       ├── ops/
│       └── internal/cron/
├── components/
├── lib/
├── models/
├── tests/phase2/
├── vercel.json
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
