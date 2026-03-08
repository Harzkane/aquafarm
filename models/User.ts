import mongoose, { Schema, model, models } from "mongoose";

const UserSchema = new Schema({
  name:      { type: String, required: true },
  email:     { type: String, required: true, unique: true, lowercase: true },
  password:  { type: String, required: true },
  farmName:  { type: String, default: "My Catfish Farm" },
  location:  { type: String, default: "Abuja, Nigeria" },
  plan:      { type: String, enum: ["free", "pro"], default: "free" },
  createdAt: { type: Date, default: Date.now },
});

export const User = models.User || model("User", UserSchema);
