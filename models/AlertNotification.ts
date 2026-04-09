import { Schema, model, models } from "mongoose";

const AlertNotificationSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  key: { type: String, required: true },
  source: { type: String, required: true },
  severity: { type: String, enum: ["info", "warning", "critical"], required: true },
  severityRank: { type: Number, default: 1 },
  status: {
    type: String,
    enum: ["new", "acknowledged", "in_progress", "resolved", "muted"],
    default: "new",
    index: true,
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  href: { type: String, default: "" },
  active: { type: Boolean, default: true, index: true },
  acknowledgedAt: { type: Date, default: null },
  acknowledgedByUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  acknowledgedByName: { type: String, default: "" },
  resolvedAt: { type: Date, default: null },
  resolvedByUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  resolvedByName: { type: String, default: "" },
  resolutionNote: { type: String, default: "" },
  assignedToUserId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
  assignedToName: { type: String, default: "" },
  nextStepNote: { type: String, default: "" },
  followUpDueAt: { type: Date, default: null },
  verificationStatus: {
    type: String,
    enum: ["pending", "scheduled", "verified", "needs_attention"],
    default: "pending",
  },
  verificationNote: { type: String, default: "" },
  verifiedAt: { type: Date, default: null },
  triggerCount: { type: Number, default: 1 },
  lastTriggeredAt: { type: Date, default: Date.now },
  lastDeliveredAt: { type: Date, default: null },
  meta: { type: Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

AlertNotificationSchema.index({ userId: 1, key: 1 }, { unique: true });
AlertNotificationSchema.index({ userId: 1, active: 1, status: 1, severityRank: -1, updatedAt: -1 });

export const AlertNotification =
  models.AlertNotification || model("AlertNotification", AlertNotificationSchema);
