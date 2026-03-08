import { Schema, model, models } from "mongoose";

const TankSchema = new Schema({
  userId:       { type: Schema.Types.ObjectId, ref: "User", required: true },
  name:         { type: String, required: true },
  type:         { type: String, enum: ["tarpaulin", "half-cut", "concrete", "fiberglass"], required: true },
  capacity:     { type: Number, required: true },    // litres (full)
  workingVolume: Number,                             // litres at 75-80%
  dimensions:   String,
  status:       { type: String, enum: ["active", "empty", "cleaning", "quarantine"], default: "empty" },
  currentBatch: { type: Schema.Types.ObjectId, ref: "Batch" },
  currentFish:  { type: Number, default: 0 },
  targetFishCapacity: { type: Number, default: 0 },
  notes:        String,
  createdAt:    { type: Date, default: Date.now },
});

export const Tank = models.Tank || model("Tank", TankSchema);
