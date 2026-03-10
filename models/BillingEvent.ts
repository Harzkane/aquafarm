import { Schema, model, models } from "mongoose";

const BillingEventSchema = new Schema({
  eventKey: { type: String, required: true, unique: true },
  eventType: { type: String, required: true },
  provider: { type: String, default: "paystack" },
  userId: { type: Schema.Types.ObjectId, ref: "User" },
  reference: String,
  createdAt: { type: Date, default: Date.now },
});

BillingEventSchema.index({ createdAt: 1 });

export const BillingEvent = models.BillingEvent || model("BillingEvent", BillingEventSchema);
