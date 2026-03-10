import { Schema, model, models } from "mongoose";

const CronRunSchema = new Schema({
  job: { type: String, required: true, index: true },
  status: { type: String, enum: ["success", "failed"], required: true, index: true },
  dryRun: { type: Boolean, default: false },
  durationMs: { type: Number, default: 0 },
  metrics: { type: Schema.Types.Mixed, default: {} },
  error: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now, index: true },
});

CronRunSchema.index({ job: 1, createdAt: -1 });

export const CronRun = models.CronRun || model("CronRun", CronRunSchema);

