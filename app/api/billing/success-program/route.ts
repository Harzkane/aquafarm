import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { recordAuditEvent } from "@/lib/audit";

type SuccessAction = "complete_onboarding" | "log_checkin";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role === "staff") {
    return NextResponse.json({ error: "Only account owners can manage success program." }, { status: 403 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const action = String(body?.action || "") as SuccessAction;
  if (!["complete_onboarding", "log_checkin"].includes(action)) {
    return NextResponse.json({ error: "Invalid success program action." }, { status: 400 });
  }
  const notes = String(body?.notes || "").trim().slice(0, 600);

  await connectDB();
  const user = await User.findById((session.user as any).id);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (user.plan !== "commercial") {
    return NextResponse.json({ error: "Success program is available on Commercial plan only." }, { status: 403 });
  }

  const now = new Date();
  if (action === "complete_onboarding") {
    user.successOnboardingStatus = "completed";
    user.successOnboardingCompletedAt = now;
    user.successOnboardingNotes = notes;
    if (!user.successCheckInNextAt) {
      user.successCheckInNextAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    }
  } else {
    user.successCheckInLastAt = now;
    user.successCheckInNextAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const history = Array.isArray(user.successCheckInHistory) ? user.successCheckInHistory : [];
    history.unshift({
      date: now,
      notes,
      actorUserId: (session.user as any).memberUserId || (session.user as any).id,
      actorName: session.user?.name || "",
    });
    user.successCheckInHistory = history.slice(0, 24);
  }

  await user.save();

  await recordAuditEvent({
    sessionUser: session.user,
    action: action === "complete_onboarding" ? "success_onboarding_completed" : "success_monthly_checkin_logged",
    resource: "success_program",
    resourceId: user._id.toString(),
    summary:
      action === "complete_onboarding"
        ? "Completed Commercial onboarding milestone"
        : "Logged Commercial monthly check-in",
    meta: { notesLength: notes.length, nextCheckInAt: user.successCheckInNextAt || null },
  }).catch(() => {});

  return NextResponse.json({
    ok: true,
    successProgram: {
      onboardingStatus: user.successOnboardingStatus || "not_started",
      onboardingCompletedAt: user.successOnboardingCompletedAt || null,
      onboardingNotes: user.successOnboardingNotes || "",
      checkInLastAt: user.successCheckInLastAt || null,
      checkInNextAt: user.successCheckInNextAt || null,
      checkInHistory: (user.successCheckInHistory || []).map((item: any) => ({
        date: item.date,
        notes: item.notes || "",
        actorName: item.actorName || "",
      })),
    },
  });
}
