import { Schema, model, models } from "mongoose";

const AlertDeliverySchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  alertId: { type: Schema.Types.ObjectId, ref: "AlertNotification", required: true, index: true },
  channel: { type: String, enum: ["whatsapp", "email"], required: true, index: true },
  status: { type: String, enum: ["sent", "failed", "skipped"], required: true, index: true },
  reason: { type: String, default: "" },
  providerMessageId: { type: String, default: "" },
  alertVersion: { type: Number, required: true },
  payload: { type: Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now, index: true },
});

AlertDeliverySchema.index({ userId: 1, alertId: 1, channel: 1, alertVersion: 1 }, { unique: true });
AlertDeliverySchema.index({ createdAt: 1 });

export const AlertDelivery = models.AlertDelivery || model("AlertDelivery", AlertDeliverySchema);
