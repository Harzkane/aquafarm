import { Schema, model, models } from "mongoose";

const CalendarEventSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  batchId: { type: Schema.Types.ObjectId, ref: "Batch", required: true },
  kind: { type: String, enum: ["sort", "harvest"], required: true },
  milestoneWeek: { type: Number, required: true },
  completedAt: { type: Date, required: true, default: Date.now },
  notes: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
});

CalendarEventSchema.index({ userId: 1, batchId: 1, kind: 1, milestoneWeek: 1 }, { unique: true });

export const CalendarEvent = models.CalendarEvent || model("CalendarEvent", CalendarEventSchema);
