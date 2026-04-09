import { Schema, model, models } from "mongoose";

const AlertIncidentSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  incidentKey: { type: String, required: true },
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
  summary: { type: String, default: "" },
  href: { type: String, default: "" },
  entityType: { type: String, default: "" },
  alertKeys: { type: [String], default: [] },
  alertCount: { type: Number, default: 1 },
  active: { type: Boolean, default: true, index: true },
  assignedToUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
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
  resolvedAt: { type: Date, default: null },
  lastTriggeredAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

AlertIncidentSchema.index({ userId: 1, incidentKey: 1 }, { unique: true });
AlertIncidentSchema.index({ userId: 1, active: 1, severityRank: -1, updatedAt: -1 });

export const AlertIncident =
  models.AlertIncident || model("AlertIncident", AlertIncidentSchema);
