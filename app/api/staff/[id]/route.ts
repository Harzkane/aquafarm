import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Types } from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { recordAuditEvent } from "@/lib/audit";

async function getCommercialOwnerFromSession() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Unauthorized", status: 401 } as const;

  await connectDB();
  const actorId = (session.user as any).memberUserId || (session.user as any).id;
  if (!Types.ObjectId.isValid(actorId)) return { error: "Invalid user session", status: 400 } as const;

  const actor = await User.findById(actorId).select("role plan");
  if (!actor) return { error: "User not found", status: 404 } as const;
  const actorRole = actor.role === "staff" ? "staff" : "owner";
  if (actorRole !== "owner") return { error: "Only account owners can manage staff.", status: 403 } as const;
  if (actor.plan !== "commercial") {
    return { error: "Staff access is available on Commercial plan only.", status: 403 } as const;
  }

  return { owner: actor } as const;
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const ownerResult = await getCommercialOwnerFromSession();
  if (!("owner" in ownerResult)) {
    return NextResponse.json({ error: ownerResult.error }, { status: ownerResult.status });
  }

  if (!Types.ObjectId.isValid(params.id)) {
    return NextResponse.json({ error: "Invalid staff id" }, { status: 400 });
  }

  const deleted = await User.findOneAndDelete({
    _id: params.id,
    role: "staff",
    farmOwnerId: ownerResult.owner._id,
  });
  if (!deleted) return NextResponse.json({ error: "Staff user not found" }, { status: 404 });
  await recordAuditEvent({
    sessionUser: session.user,
    action: "delete",
    resource: "staff_user",
    resourceId: deleted._id.toString(),
    summary: `Removed staff user ${deleted.email}`,
    meta: { name: deleted.name, email: deleted.email },
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
