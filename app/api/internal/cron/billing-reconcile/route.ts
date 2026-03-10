import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { computeBillingReconcile } from "@/lib/billing-reconcile";
import { logCronRun } from "@/lib/cron-log";
import { clampInt, isCronAuthorized, parseDryRunFlag } from "@/lib/cron-utils";

function isAuthorized(req: NextRequest) {
  return isCronAuthorized(process.env.CRON_SECRET, req.headers.get("authorization"));
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const dryRun = parseDryRunFlag(searchParams.get("dryRun"));
  const limit = clampInt(searchParams.get("limit"), 100, 1, 200);
  const now = new Date();
  const startedAt = Date.now();

  try {
    await connectDB();

    // Keep the query selective so cron runs remain cheap on Vercel.
    const candidates = await User.find({
      role: "owner",
      $or: [
        { cancelAtPeriodEnd: true },
        { scheduledPlan: "free" },
        {
          billingStatus: "canceled",
          $or: [{ canceledAt: null }, { canceledAt: { $exists: false } }],
        },
        { plan: "free", billingStatus: "active", cancelAtPeriodEnd: { $ne: true } },
        {
          plan: { $in: ["pro", "commercial"] },
          billingStatus: { $in: ["inactive", "canceled"] },
          billingExpiresAt: { $lte: now },
        },
        {
          plan: { $in: ["pro", "commercial"] },
          cancelAtPeriodEnd: true,
          billingExpiresAt: { $lte: now },
        },
      ],
    })
      .select("_id plan billingStatus billingExpiresAt cancelAtPeriodEnd scheduledPlan canceledAt")
      .sort({ billingExpiresAt: 1, _id: 1 })
      .limit(limit)
      .lean<any[]>();

    let touched = 0;
    const updates: Array<{ updateOne: { filter: any; update: any } }> = [];
    const samples: Array<{ userId: string; actionCount: number }> = [];

    for (const user of candidates) {
      const { actions, patch } = computeBillingReconcile(user, now);
      if (!actions.length) continue;
      touched += 1;
      if (samples.length < 20) {
        samples.push({ userId: String(user._id), actionCount: actions.length });
      }
      if (!dryRun) {
        updates.push({
          updateOne: {
            filter: { _id: user._id },
            update: { $set: patch },
          },
        });
      }
    }

    if (!dryRun && updates.length > 0) {
      await User.bulkWrite(updates, { ordered: false });
    }

    const response = {
      ok: true,
      dryRun,
      checked: candidates.length,
      updated: touched,
      skipped: candidates.length - touched,
      nextSuggestedCursor: candidates.length === limit ? String(candidates[candidates.length - 1]?._id || "") : "",
      samples,
    };

    await logCronRun({
      job: "billing-reconcile",
      status: "success",
      dryRun,
      durationMs: Date.now() - startedAt,
      metrics: { checked: response.checked, updated: response.updated, skipped: response.skipped, limit },
    });

    return NextResponse.json(response);
  } catch (error: any) {
    await logCronRun({
      job: "billing-reconcile",
      status: "failed",
      dryRun,
      durationMs: Date.now() - startedAt,
      metrics: { limit },
      error: String(error?.message || error || "Unknown error"),
    });
    return NextResponse.json({ error: "Billing reconcile cron failed" }, { status: 500 });
  }
}
