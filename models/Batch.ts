import { Schema, model, models } from "mongoose";

const TankAllocationSchema = new Schema({
  tankId:    String,
  tankName:  String,
  fishCount: Number,
  phase:     String,
}, { _id: false });

const BatchSchema = new Schema({
  userId:          { type: Schema.Types.ObjectId, ref: "User", required: true },
  name:            { type: String, required: true },
  stockingDate:    { type: Date, required: true },
  initialCount:    { type: Number, required: true, default: 550 },
  currentCount:    { type: Number, required: true },
  initialWeight:   { type: Number, default: 15 }, // avg grams at stocking
  targetWeight:    { type: Number, default: 1000 }, // grams
  targetHarvestDate: Date,
  status:          { type: String, enum: ["active","harvested","partial"], default: "active" },
  harvestDate:     Date,
  harvestedWeightKg: Number,
  harvestPricePerKg: Number,
  harvestNotes:    String,
  tankAllocations: [TankAllocationSchema],
  notes:           String,
  juvenileCost:    { type: Number, default: 35000 }, // total ₦
  deletedAt:       Date,
  createdAt:       { type: Date, default: Date.now },
});

export const Batch = models.Batch || model("Batch", BatchSchema);
