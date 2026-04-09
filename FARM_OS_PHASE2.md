# AquaFarm Farm OS Phase 2

## Purpose
This document keeps AquaFarm aligned as we move from a strong farm management platform into a true Farm OS.

We should use it to judge new work, reject distractions, and make sure each product change strengthens daily farm control rather than just adding more screens.

## Product North Star
AquaFarm should become the default daily control system for aquaculture operations.

That means:
- a farmer opens AquaFarm first to know what matters today
- the system holds the operational truth of the farm
- one event in the farm leads to the right next action in the product
- history improves future decisions
- operators trust it as the source of truth, not just a place to type records

## What AquaFarm Already Is
AquaFarm is already more than a tracker.

It currently has:
- batch, tank, feeding, mortality, water quality, harvest, feed inventory, financials, reports, alerts, calendar, playbook, staff, billing, audit, and ops monitoring
- cross-module write logic in core areas
- dashboard action generation
- alert rules across operations, health, planning, and business
- planning milestones and SOP guidance
- owner-facing operational observability

## Current Farm OS Status
Current status: `Early Farm OS`

Why:
- the platform already captures real farm operations
- the system already connects multiple modules logically
- the dashboard and alerts already provide some operational guidance
- but the system still stops too often at signal instead of coordinated response

## What Must Be True For "Real Farm OS"
We should only call AquaFarm a true Farm OS when these are consistently true:

1. The dashboard acts like a command center.
It should tell the operator:
- what needs attention now
- why it matters
- what to do next
- what is getting worse
- what is already under control

2. Core logging becomes habit-fast.
Daily logging must feel fast enough to become a routine, not a burden.

3. Signals become guided workflows.
Example:
- water issue logged
- alert triggered
- recommended action shown
- follow-up check requested
- outcome recorded

4. Reports help run the farm, not just describe it.
Reports should increasingly answer:
- which batch is healthiest
- which tank is risky
- whether growth is on track
- whether harvest timing is improving
- whether feed usage is efficient

5. AquaFarm becomes trusted operational memory.
The team should rely on the product to answer:
- what happened
- who changed what
- what action was taken
- whether it worked

## What We Already Have
### Strong foundations
- Central event model through daily logs
- Batch and tank allocation logic
- Harvest and revenue linkage
- Feed runway intelligence
- Calendar milestones
- Alert generation
- Audit visibility

### Strong product shape
- public positioning is clearer
- core workflows now explain themselves better
- the product feels more coherent across modules than before

## Current Gaps
### 1. Dashboard is not yet a true command center
Current state:
- action items exist
- useful summaries exist
- multiple modules feed the dashboard

Gap:
- actions are still mostly navigational, not workflow-driven
- no persistent task lifecycle
- limited prioritization logic

Needed:
- task-style action model
- priority scoring
- follow-up and verification states

### 2. Data model is richer than the intelligence layer
Current state:
- logs already include `fishCount`, `avgWeight`, `dissolvedO2`, mortality, water values, feed data

Gap:
- some important fields are underused
- dissolved oxygen is not deeply surfaced in alerts/dashboard
- growth signals are not strongly turned into guidance

Needed:
- growth trend logic
- DO-aware health scoring
- harvest-readiness intelligence

### 3. Alerts surface issues but do not fully coordinate response
Current state:
- strong rule categories exist
- alerts can be acknowledged, assigned, muted, resolved

Gap:
- alerts do not yet carry recommended remediation flows
- no explicit follow-up verification pattern
- no outcome memory per alert type

Needed:
- alert playbooks
- required next step suggestions
- post-action verification

### 4. Financial truth is still partially split
Current state:
- feed inventory tracks purchases and runway
- financials track expenses and revenue

Gap:
- feed purchases are not automatically reflected into financial expenses
- cost truth can drift from operational truth

Needed:
- optional auto-posting of feed purchases into expenses
- tighter cost-of-production logic

### 5. Reports are descriptive more than predictive
Current state:
- reports summarize finance, feed, mortality, water risk, and batch performance

Gap:
- limited forward-looking guidance
- limited operational recommendations from trends

Needed:
- batch confidence scoring
- growth trend vs target
- predicted risk and readiness signals

## Phase 2 Priorities
## Priority 1: Command Center
Goal:
Make the dashboard the first screen farmers trust every morning.

Deliver:
- today’s priorities
- blocked items
- overdue actions
- verified completions
- stronger explanation of why each task exists

Primary files:
- `app/(dashboard)/dashboard/page.tsx`
- `app/(dashboard)/dashboard/DashboardClient.tsx`

## Priority 2: Event Engine
Goal:
Make daily logs the true operating event stream of the farm.

Deliver:
- stronger use of `fishCount`
- stronger use of `avgWeight`
- stronger use of `dissolvedO2`
- more structured follow-up from critical events

Primary files:
- `models/DailyLog.ts`
- `app/api/logs/route.ts`
- `app/api/water-quality/route.ts`
- `lib/validators/logs.ts`

## Priority 3: Alert-to-Action Loop
Goal:
Turn alerts into operational response workflows.

Deliver:
- suggested action per alert
- escalation guidance
- follow-up verification state
- clearer resolution quality

Primary files:
- `app/(dashboard)/alerts/page.tsx`
- `lib/alert-rules/operations.ts`
- `lib/alert-rules/health.ts`
- `lib/alert-rules/planning.ts`
- `lib/alert-rules/business.ts`
- `lib/alerts.ts`

## Priority 4: Unified Operational and Financial Truth
Goal:
Reduce drift between what happened on the farm and what appears in costs/revenue.

Deliver:
- feed purchase to expense sync option
- clearer production cost visibility
- stronger batch economics

Primary files:
- `app/api/feed-inventory/route.ts`
- `app/api/financials/route.ts`
- `models/Financial.ts`
- `lib/reports.ts`

## Priority 5: Predictive Reports
Goal:
Make reports support decision-making, not just review.

Deliver:
- growth vs target
- likely harvest readiness
- risk hotspots
- confidence/reliability scoring

Primary files:
- `app/api/reports/summary/route.ts`
- `lib/reports.ts`

## Guardrails
We should reject work that:
- adds new modules without improving the daily control loop
- expands breadth without strengthening cross-module intelligence
- increases data entry burden without immediate farmer value
- adds admin complexity before operator value becomes stronger

We should prefer work that:
- improves daily action clarity
- tightens speed of repeated workflows
- increases trust in operational truth
- links one event to the next correct action
- makes outcomes easier to prove

## Working Definition For Decisions
Before building anything new, ask:

1. Does this help the farmer run the farm today?
2. Does this improve the system’s understanding of farm reality?
3. Does this create a better next action, not just more information?
4. Does this strengthen AquaFarm as the source of truth?

If the answer is mostly no, we should probably not do it yet.

## Immediate Next Build Sequence
1. Upgrade dashboard actions into a stronger command-center model
2. Expand log intelligence to use growth and DO signals better
3. Add alert remediation guidance and follow-up flow
4. Connect feed inventory and financial expense truth
5. Make reports more predictive and operational

## Success Marker For End Of Phase 2
We should consider Phase 2 successful when:
- active farmers can use AquaFarm to know what to do today
- the system can explain why a task matters
- major farm signals trigger clear next actions
- reports help guide the next operating decision
- AquaFarm feels like the farm’s operating system, not a set of isolated tools
