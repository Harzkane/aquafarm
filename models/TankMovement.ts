import { Schema, model, models } from "mongoose";

const TankMovementSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  batchId: { type: Schema.Types.ObjectId, ref: "Batch", required: true },
  fromTankId: { type: Schema.Types.ObjectId, ref: "Tank", required: true },
  toTankId: { type: Schema.Types.ObjectId, ref: "Tank", required: true },
  fromTankName: { type: String, required: true },
  toTankName: { type: String, required: true },
  count: { type: Number, required: true, min: 1 },
  date: { type: Date, default: Date.now },
  reason: { type: String, default: "sorting" },
  notes: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
});

export const TankMovement = models.TankMovement || model("TankMovement", TankMovementSchema);
