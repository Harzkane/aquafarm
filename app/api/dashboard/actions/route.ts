import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { CommandActionState } from "@/models/CommandActionState";

type CommandActionStatus = "open" | "completed" | "snoozed";

function normalizeStatus(value: unknown): CommandActionStatus | "" {
  if (value === "open" || value === "completed" || value === "snoozed") return value;
  return "";
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const key = String(body?.key || "").trim();
  const status = normalizeStatus(body?.status);
  const title = String(body?.title || "").trim().slice(0, 180);
  const href = String(body?.href || "").trim().slice(0, 280);
  const category = String(body?.category || "").trim().slice(0, 80);
  const level = body?.level === "danger" || body?.level === "warning" || body?.level === "info" ? body.level : "info";
  const snoozeDays = Math.max(1, Math.min(Number(body?.snoozeDays || 1), 14));

  if (!key) return NextResponse.json({ error: "Action key is required" }, { status: 400 });
  if (!status) return NextResponse.json({ error: "Valid status is required" }, { status: 400 });

  await connectDB();
  const userId = (session.user as any).id;
  const now = new Date();

  const update: Record<string, unknown> = {
    title,
    href,
    category,
    level,
    status,
    updatedAt: now,
  };

  if (status === "completed") {
    update.completedAt = now;
    update.snoozeUntil = null;
  } else if (status === "snoozed") {
    const snoozeUntil = new Date(now);
    snoozeUntil.setDate(snoozeUntil.getDate() + snoozeDays);
    snoozeUntil.setHours(0, 0, 0, 0);
    update.snoozeUntil = snoozeUntil;
    update.completedAt = null;
  } else {
    update.completedAt = null;
    update.snoozeUntil = null;
  }

  const state = await CommandActionState.findOneAndUpdate(
    { userId, key },
    { $set: update, $setOnInsert: { userId, key } },
    { upsert: true, new: true },
  ).lean<any>();

  return NextResponse.json({
    ok: true,
    state: {
      key: String(state.key),
      status: String(state.status || "open"),
      completedAt: state.completedAt ? new Date(state.completedAt).toISOString() : null,
      snoozeUntil: state.snoozeUntil ? new Date(state.snoozeUntil).toISOString() : null,
    },
  });
}
