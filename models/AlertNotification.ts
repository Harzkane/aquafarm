import { Schema, model, models } from "mongoose";

const AlertNotificationSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  key: { type: String, required: true },
  source: { type: String, required: true },
  severity: { type: String, enum: ["info", "warning", "critical"], required: true },
  severityRank: { type: Number, default: 1 },
  title: { type: String, required: true },
  message: { type: String, required: true },
  href: { type: String, default: "" },
  active: { type: Boolean, default: true, index: true },
  acknowledgedAt: { type: Date, default: null },
  resolvedAt: { type: Date, default: null },
  triggerCount: { type: Number, default: 1 },
  lastTriggeredAt: { type: Date, default: Date.now },
  meta: { type: Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

AlertNotificationSchema.index({ userId: 1, key: 1 }, { unique: true });
AlertNotificationSchema.index({ userId: 1, active: 1, severityRank: -1, updatedAt: -1 });

export const AlertNotification =
  models.AlertNotification || model("AlertNotification", AlertNotificationSchema);
