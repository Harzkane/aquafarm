import { Schema, model, models } from "mongoose";

const AuditLogSchema = new Schema({
  ownerUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  actorUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  actorName: { type: String, default: "" },
  actorEmail: { type: String, default: "" },
  role: { type: String, enum: ["owner", "staff"], default: "owner" },
  action: { type: String, required: true, index: true },
  resource: { type: String, required: true, index: true },
  resourceId: { type: String, default: "" },
  summary: { type: String, default: "" },
  meta: { type: Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now, index: true },
});

AuditLogSchema.index({ ownerUserId: 1, createdAt: -1 });

export const AuditLog = models.AuditLog || model("AuditLog", AuditLogSchema);
