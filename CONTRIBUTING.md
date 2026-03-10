# Contributing

## Prerequisites
- Node.js 18+
- npm
- MongoDB Atlas connection string

## Local Setup
1. Install dependencies:
   - `npm install`
2. Copy env template:
   - `cp .env.local.example .env.local`
3. Fill required env vars:
   - `MONGODB_URI`
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL`
   - (optional for full SaaS simulation) Paystack + Upstash + `CRON_SECRET`
4. Run app:
   - `npm run dev`

## Quality Gates
- Lint:
  - `npm run lint`
- Phase-2 tests:
  - `npm run test:phase2`

## Branching and Change Style
- Keep PRs scoped by concern:
  - Core logic
  - API/auth
  - UI
  - Docs
- Prefer reusable logic in `lib/*` for testability.
- For multi-document writes, prefer atomic execution (`runAtomic`).

## Security and Secrets
- Never commit `.env.local`.
- Use placeholders in docs and examples.
- Rotate secrets immediately if exposed.

## Release Checklist
Before production release:
1. Run lint and test suite.
2. Confirm env vars in Vercel.
3. Confirm cron schedules and auth token behavior.
4. Follow `PHASE2_RELEASE_CHECKLIST.md`.

