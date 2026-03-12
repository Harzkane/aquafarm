import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Types } from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { AlertNotification } from "@/models/AlertNotification";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ownerUserId = (session.user as any).id;

  if (!Types.ObjectId.isValid(params.id)) {
    return NextResponse.json({ error: "Invalid alert id" }, { status: 400 });
  }

  await connectDB();
  const now = new Date();
  const updated = await AlertNotification.findOneAndUpdate(
    { _id: params.id, userId: ownerUserId },
    { $set: { active: false, acknowledgedAt: now, resolvedAt: now, updatedAt: now } },
    { new: true }
  ).lean<any>();

  if (!updated) return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
