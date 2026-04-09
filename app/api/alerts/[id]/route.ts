import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Types } from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { AlertNotification } from "@/models/AlertNotification";
import { User } from "@/models/User";

type AlertStatus = "new" | "acknowledged" | "in_progress" | "resolved" | "muted";
type VerificationStatus = "pending" | "scheduled" | "verified" | "needs_attention";

async function getAlertActor() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Unauthorized", status: 401 } as const;

  await connectDB();
  const ownerUserId = String((session.user as any).id || "");
  const actorUserId = String((session.user as any).memberUserId || ownerUserId);
  if (!Types.ObjectId.isValid(ownerUserId) || !Types.ObjectId.isValid(actorUserId)) {
    return { error: "Invalid user session", status: 400 } as const;
  }

  const actor = await User.findById(actorUserId).select("_id name role farmOwnerId").lean<any>();
  if (!actor) return { error: "User not found", status: 404 } as const;

  const actorRole = actor.role === "staff" ? "staff" : "owner";
  if (actorRole === "staff" && String(actor.farmOwnerId || "") !== ownerUserId) {
    return { error: "Unauthorized", status: 403 } as const;
  }

  return {
    ownerUserId,
    actor: {
      id: String(actor._id),
      name: String(actor.name || "Team member"),
      role: actorRole,
    },
  } as const;
}

function normalizeStatus(value: unknown): AlertStatus | "" {
  if (value === "new" || value === "acknowledged" || value === "in_progress" || value === "resolved" || value === "muted") {
    return value;
  }
  return "";
}

function normalizeVerificationStatus(value: unknown): VerificationStatus | "" {
  if (value === "pending" || value === "scheduled" || value === "verified" || value === "needs_attention") {
    return value;
  }
  return "";
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const sessionResult = await getAlertActor();
  if (!("ownerUserId" in sessionResult)) {
    return NextResponse.json({ error: sessionResult.error }, { status: sessionResult.status });
  }
  const ownerUserId = sessionResult.ownerUserId;
  const actor = sessionResult.actor!;

  if (!Types.ObjectId.isValid(params.id)) {
    return NextResponse.json({ error: "Invalid alert id" }, { status: 400 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const status = normalizeStatus(body?.status);
  const verificationStatus = normalizeVerificationStatus(body?.verificationStatus);
  const assignedToUserIdRaw = String(body?.assignedToUserId || "").trim();
  const resolutionNote = String(body?.resolutionNote || "").trim().slice(0, 500);
  const nextStepNote = typeof body?.nextStepNote === "string" ? body.nextStepNote.trim().slice(0, 280) : null;
  const verificationNote = typeof body?.verificationNote === "string" ? body.verificationNote.trim().slice(0, 280) : null;
  const followUpDueAtRaw = body?.followUpDueAt;

  const alert = await AlertNotification.findOne({
    _id: params.id,
    userId: ownerUserId,
  });
  if (!alert) return NextResponse.json({ error: "Alert not found" }, { status: 404 });

  const now = new Date();
  if (nextStepNote !== null) {
    alert.nextStepNote = nextStepNote;
  }
  if (verificationNote !== null) {
    alert.verificationNote = verificationNote;
  }
  if (followUpDueAtRaw !== undefined) {
    if (followUpDueAtRaw === null || followUpDueAtRaw === "") {
      alert.followUpDueAt = null;
    } else {
      const parsed = new Date(followUpDueAtRaw);
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: "Invalid follow-up date" }, { status: 400 });
      }
      alert.followUpDueAt = parsed;
    }
  }
  if (verificationStatus) {
    alert.verificationStatus = verificationStatus;
    if (verificationStatus === "verified") {
      alert.verifiedAt = now;
    } else if (verificationStatus === "pending") {
      alert.verifiedAt = null;
    }
  }

  if (assignedToUserIdRaw !== "") {
    if (!Types.ObjectId.isValid(assignedToUserIdRaw)) {
      return NextResponse.json({ error: "Invalid assignee" }, { status: 400 });
    }
    const assignee = await User.findOne({
      _id: assignedToUserIdRaw,
      $or: [
        { _id: sessionResult.ownerUserId, role: "owner" },
        { farmOwnerId: sessionResult.ownerUserId, role: "staff" },
      ],
    })
      .select("_id name")
      .lean<any>();
    if (!assignee) {
      return NextResponse.json({ error: "Assignee not found in this farm workspace" }, { status: 404 });
    }
    alert.assignedToUserId = assignee._id;
    alert.assignedToName = String(assignee.name || "Team member");
  } else if (body?.assignedToUserId === null || body?.assignedToUserId === "") {
    alert.assignedToUserId = null;
    alert.assignedToName = "";
  }

  if (status) {
    alert.status = status;
    if (status === "acknowledged") {
        alert.acknowledgedAt = now;
        alert.acknowledgedByUserId = new Types.ObjectId(actor.id);
        alert.acknowledgedByName = actor.name;
        alert.active = true;
        alert.resolvedAt = null;
      } else if (status === "in_progress") {
        if (!alert.acknowledgedAt) {
          alert.acknowledgedAt = now;
          alert.acknowledgedByUserId = new Types.ObjectId(actor.id);
          alert.acknowledgedByName = actor.name;
        }
        alert.active = true;
        alert.resolvedAt = null;
      } else if (status === "resolved") {
        alert.active = false;
        alert.resolvedAt = now;
        alert.resolvedByUserId = new Types.ObjectId(actor.id);
        alert.resolvedByName = actor.name;
        alert.resolutionNote = resolutionNote;
      } else if (status === "muted" || status === "new") {
      alert.active = true;
      if (status === "new") {
        alert.resolvedAt = null;
        alert.resolvedByUserId = null;
        alert.resolvedByName = "";
        alert.resolutionNote = "";
      }
    }
  }

  alert.updatedAt = now;
  await alert.save();

  return NextResponse.json({
    ok: true,
    alert: {
      _id: String(alert._id),
      status: alert.status,
      active: Boolean(alert.active),
      assignedToUserId: alert.assignedToUserId ? String(alert.assignedToUserId) : "",
      assignedToName: String(alert.assignedToName || ""),
      resolutionNote: String(alert.resolutionNote || ""),
      nextStepNote: String(alert.nextStepNote || ""),
      followUpDueAt: alert.followUpDueAt ? new Date(alert.followUpDueAt).toISOString() : null,
      verificationStatus: String(alert.verificationStatus || "pending"),
      verificationNote: String(alert.verificationNote || ""),
      verifiedAt: alert.verifiedAt ? new Date(alert.verifiedAt).toISOString() : null,
    },
  });
}
