# AquaFarm Product Overview

## What AquaFarm Is
AquaFarm is a multi-tenant aquaculture management and planning platform for catfish farms, built as a SaaS application.

It combines day-to-day farm operations, planning workflows, and subscription controls in one workspace.

## Core Product Areas
- Operations:
  - Batches, tanks, daily logs, mortality tracking, water quality tracking
  - Tank movement logging and harvest recording
- Planning:
  - Calendar milestones (sort/harvest checkpoints)
  - Playbook/SOP reference and dashboard action prompts
- Commercials:
  - Financial expenses/revenue tracking
  - Feed inventory and usage visibility
  - Reports and CSV export
- SaaS Controls:
  - Plan tiers (`free`, `pro`, `commercial`)
  - Paystack billing lifecycle (checkout, verify, webhook, cancel)
  - Staff access for Commercial owners
  - Operational audit logs
  - Cron-based billing reconciliation and retention maintenance

## Target Users
- Farm owners (primary operators)
- Farm staff (workspace members under owner account on Commercial plan)

## Plan Tiers (Current)
- Free:
  - Max active batches: `1`
  - Max tanks: `4`
  - Report history limit: `30` days
  - No staff seats
- Pro Founder:
  - Max active batches: `5`
  - Unlimited tanks
  - Full report history
  - No staff seats
- Pro+ Commercial:
  - Unlimited active batches
  - Unlimited tanks
  - Staff seats: `5`
  - Commercial success program tooling
  - Advanced ops visibility

## What “Planning” Means in Current Product
- Milestone planning via calendar events and batch week checkpoints
- Prompt-based operational guidance from dashboard and playbook
- Cross-module reports that support trend-based planning decisions

## Current Product Status
The platform is production-capable as aquafarm management + planning software, with Phase-2 hardening in place:
- Atomic multi-document write guards on critical workflows
- Distributed middleware rate limiting (Upstash REST; local fallback)
- Scheduled cron operations for billing consistency and billing-event retention
- Ops monitor visibility for cron health and failures
- Phase-2 validation suite for core business logic

