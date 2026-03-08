import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, farmName } = await req.json();
    if (!name || !email || !password) return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    if (password.length < 6) return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });

    await connectDB();
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return NextResponse.json({ error: "Email already registered" }, { status: 409 });

    const hashed = await bcrypt.hash(password, 12);
    await User.create({ name, email: email.toLowerCase(), password: hashed, farmName: farmName || "My Catfish Farm" });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
