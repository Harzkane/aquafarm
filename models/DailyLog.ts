import { Schema, model, models } from "mongoose";

const DailyLogSchema = new Schema({
  userId:        { type: Schema.Types.ObjectId, ref: "User", required: true },
  batchId:       { type: Schema.Types.ObjectId, ref: "Batch", required: true },
  date:          { type: Date, required: true, default: Date.now },
  tankId:        String,
  tankName:      String,
  feedSession:   { type: String, enum: ["morning", "evening"], default: "morning" },
  feedGiven:     { type: Number, default: 0 },    // kg
  feedType:      String,
  feedBrand:     String,
  feedSizeMm:    Number,
  mortality:     { type: Number, default: 0 },    // count
  mortalityCause: String,
  fishCount:     Number,
  avgWeight:     Number,                          // grams estimated
  ph:            Number,
  ammonia:       Number,
  temperature:   Number,
  dissolvedO2:   Number,
  waterChanged:  { type: Boolean, default: false },
  waterChangePct: Number,
  observations:  String,
  createdAt:     { type: Date, default: Date.now },
});

export const DailyLog = models.DailyLog || model("DailyLog", DailyLogSchema);
