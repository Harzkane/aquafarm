import mongoose, { Schema, model, models } from "mongoose";

const UserSchema = new Schema({
  name:      { type: String, required: true },
  email:     { type: String, required: true, unique: true, lowercase: true },
  password:  { type: String, required: true },
  farmName:  { type: String, default: "My Catfish Farm" },
  location:  { type: String, default: "Abuja, Nigeria" },
  role:      { type: String, enum: ["owner", "staff"], default: "owner" },
  farmOwnerId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  isActive:  { type: Boolean, default: true },
  plan:      { type: String, enum: ["free", "pro", "commercial"], default: "free" },
  billingStatus: { type: String, enum: ["inactive", "trialing", "active", "past_due", "canceled"], default: "inactive" },
  paystackCustomerCode: { type: String, default: "" },
  paystackSubscriptionCode: { type: String, default: "" },
  paystackEmailToken: { type: String, default: "" },
  successOnboardingStatus: { type: String, enum: ["not_started", "in_progress", "completed"], default: "not_started" },
  successOnboardingCompletedAt: Date,
  successOnboardingNotes: { type: String, default: "" },
  successCheckInLastAt: Date,
  successCheckInNextAt: Date,
  successCheckInHistory: [
    {
      date: { type: Date, required: true },
      notes: { type: String, default: "" },
      actorUserId: { type: Schema.Types.ObjectId, ref: "User" },
      actorName: { type: String, default: "" },
    },
  ],
  planActivatedAt: Date,
  trialEndsAt: Date,
  billingExpiresAt: Date,
  cancelAtPeriodEnd: { type: Boolean, default: false },
  cancellationRequestedAt: Date,
  canceledAt: Date,
  scheduledPlan: { type: String, enum: ["", "free", "pro", "commercial"], default: "" },
  createdAt: { type: Date, default: Date.now },
});

UserSchema.index({ farmOwnerId: 1, role: 1 });

export const User = models.User || model("User", UserSchema);
