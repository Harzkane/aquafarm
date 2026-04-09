import { Schema, model, models } from "mongoose";

const CommandActionStateSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  key: { type: String, required: true },
  title: { type: String, default: "" },
  href: { type: String, default: "" },
  category: { type: String, default: "" },
  level: { type: String, enum: ["info", "warning", "danger"], default: "info" },
  status: { type: String, enum: ["open", "completed", "snoozed"], default: "open", index: true },
  completedAt: { type: Date, default: null },
  snoozeUntil: { type: Date, default: null },
  updatedAt: { type: Date, default: Date.now },
}, { minimize: true });

CommandActionStateSchema.index({ userId: 1, key: 1 }, { unique: true });

export const CommandActionState =
  models.CommandActionState || model("CommandActionState", CommandActionStateSchema);
