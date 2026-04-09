import { Schema, model, models } from "mongoose";

const ExpenseSchema = new Schema({
  category:    { type: String, enum: ["feed","juveniles","medication","labour","utilities","equipment","transport","other"], required: true },
  description: String,
  amount:      { type: Number, required: true },
  date:        { type: Date, default: Date.now },
  batchId:     { type: Schema.Types.ObjectId, ref: "Batch" },
  source:      { type: String, enum: ["manual", "feed_purchase"], default: "manual" },
  sourceRef:   String,
  sourceLabel: String,
});

const RevenueSchema = new Schema({
  batchId:     { type: Schema.Types.ObjectId, ref: "Batch" },
  fishSold:    Number,
  weightKg:    Number,
  pricePerKg:  Number,
  totalAmount: Number,
  buyer:       String,
  channel:     { type: String, enum: ["POK","restaurant","market","direct","hotel","other"] },
  date:        { type: Date, default: Date.now },
});

const FinancialSchema = new Schema({
  userId:   { type: Schema.Types.ObjectId, ref: "User", required: true },
  expenses: [ExpenseSchema],
  revenue:  [RevenueSchema],
  updatedAt: { type: Date, default: Date.now },
});

export const Financial = models.Financial || model("Financial", FinancialSchema);
