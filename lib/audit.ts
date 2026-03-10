import { connectDB } from "@/lib/db";
import { AuditLog } from "@/models/AuditLog";

type AuditInput = {
  sessionUser: any;
  action: string;
  resource: string;
  resourceId?: string;
  summary: string;
  meta?: Record<string, unknown>;
};

export async function recordAuditEvent(input: AuditInput) {
  const ownerUserId = input?.sessionUser?.id;
  if (!ownerUserId) return;

  await connectDB();
  await AuditLog.create({
    ownerUserId,
    actorUserId: input.sessionUser.memberUserId || ownerUserId,
    actorName: input.sessionUser.name || "",
    actorEmail: input.sessionUser.email || "",
    role: input.sessionUser.role === "staff" ? "staff" : "owner",
    action: input.action,
    resource: input.resource,
    resourceId: input.resourceId || "",
    summary: input.summary,
    meta: input.meta || {},
  });
}
