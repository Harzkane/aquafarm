import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Types } from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { AlertIncident } from "@/models/AlertIncident";
import { AlertNotification } from "@/models/AlertNotification";
import { User } from "@/models/User";

type WorkflowStatus = "new" | "acknowledged" | "in_progress" | "resolved" | "muted";

async function getIncidentActor() {
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

function normalizeStatus(value: unknown): WorkflowStatus | "" {
  if (value === "new" || value === "acknowledged" || value === "in_progress" || value === "resolved" || value === "muted") {
    return value;
  }
  return "";
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const sessionResult = await getIncidentActor();
  if (!("ownerUserId" in sessionResult)) {
    return NextResponse.json({ error: sessionResult.error }, { status: sessionResult.status });
  }
  const ownerUserId = sessionResult.ownerUserId;
  const actor = sessionResult.actor!;

  if (!Types.ObjectId.isValid(params.id)) {
    return NextResponse.json({ error: "Invalid incident id" }, { status: 400 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const status = normalizeStatus(body?.status);
  const assignedToUserIdRaw = String(body?.assignedToUserId || "").trim();
  const resolutionNote = String(body?.resolutionNote || "").trim().slice(0, 500);

  const incident = await AlertIncident.findOne({ _id: params.id, userId: ownerUserId });
  if (!incident) return NextResponse.json({ error: "Incident not found" }, { status: 404 });

  const now = new Date();
  let assigneeId: Types.ObjectId | null | undefined = undefined;
  let assigneeName: string | undefined = undefined;

  if (assignedToUserIdRaw !== "") {
    if (!Types.ObjectId.isValid(assignedToUserIdRaw)) {
      return NextResponse.json({ error: "Invalid assignee" }, { status: 400 });
    }
    const assignee = await User.findOne({
      _id: assignedToUserIdRaw,
      $or: [
        { _id: ownerUserId, role: "owner" },
        { farmOwnerId: ownerUserId, role: "staff" },
      ],
    }).select("_id name").lean<any>();
    if (!assignee) {
      return NextResponse.json({ error: "Assignee not found in this farm workspace" }, { status: 404 });
    }
    assigneeId = new Types.ObjectId(String(assignee._id));
    assigneeName = String(assignee.name || "Team member");
    incident.assignedToUserId = assigneeId;
    incident.assignedToName = assigneeName;
  } else if (body?.assignedToUserId === null || body?.assignedToUserId === "") {
    assigneeId = null;
    assigneeName = "";
    incident.assignedToUserId = null;
    incident.assignedToName = "";
  }

  if (status) {
    incident.status = status;
    if (status === "resolved") {
      incident.active = false;
      incident.resolvedAt = now;
    } else {
      incident.active = true;
      if (status === "new") incident.resolvedAt = null;
    }
  }
  incident.updatedAt = now;
  await incident.save();

  const alertSet: Record<string, unknown> = { updatedAt: now };
  if (assigneeId !== undefined) {
    alertSet.assignedToUserId = assigneeId;
    alertSet.assignedToName = assigneeName;
  }
  if (status) {
    alertSet.status = status;
    if (status === "resolved") {
      alertSet.active = false;
      alertSet.resolvedAt = now;
      alertSet.resolvedByUserId = new Types.ObjectId(actor.id);
      alertSet.resolvedByName = actor.name;
      alertSet.resolutionNote = resolutionNote;
    } else if (status === "acknowledged") {
      alertSet.active = true;
      alertSet.acknowledgedAt = now;
      alertSet.acknowledgedByUserId = new Types.ObjectId(actor.id);
      alertSet.acknowledgedByName = actor.name;
      alertSet.resolvedAt = null;
    } else if (status === "in_progress") {
      alertSet.active = true;
      alertSet.resolvedAt = null;
      alertSet.acknowledgedAt = now;
      alertSet.acknowledgedByUserId = new Types.ObjectId(actor.id);
      alertSet.acknowledgedByName = actor.name;
    } else if (status === "muted") {
      alertSet.active = true;
    } else if (status === "new") {
      alertSet.active = true;
      alertSet.resolvedAt = null;
      alertSet.resolvedByUserId = null;
      alertSet.resolvedByName = "";
      alertSet.resolutionNote = "";
    }
  }

  await AlertNotification.updateMany(
    { userId: ownerUserId, key: { $in: incident.alertKeys || [] } },
    { $set: alertSet }
  );

  return NextResponse.json({
    ok: true,
    incident: {
      _id: String(incident._id),
      status: incident.status,
      active: Boolean(incident.active),
      assignedToUserId: incident.assignedToUserId ? String(incident.assignedToUserId) : "",
      assignedToName: String(incident.assignedToName || ""),
    },
  });
}
