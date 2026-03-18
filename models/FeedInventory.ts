import { Schema, model, models } from "mongoose";

const FeedPurchaseSchema = new Schema({
  date: { type: Date, default: Date.now },
  brand: { type: String, required: true },
  pelletSizeMm: { type: Number, default: null },
  bagSizeKg: { type: Number, required: true },
  bags: { type: Number, required: true },
  totalKg: { type: Number, required: true },
  unitPrice: { type: Number, required: true },
  totalCost: { type: Number, required: true },
  supplier: { type: String, default: "" },
  notes: { type: String, default: "" },
});

const FeedInventorySchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  openingStockKg: { type: Number, default: 0 },
  openingStockBrand: { type: String, default: "" },
  openingStockSizeMm: { type: Number, default: null },
  purchases: [FeedPurchaseSchema],
  updatedAt: { type: Date, default: Date.now },
});

export const FeedInventory = models.FeedInventory || model("FeedInventory", FeedInventorySchema);
