import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { markBillingEventProcessed, applySuccessfulPayment, hasProcessedBillingEvent } from "@/lib/billing";

const PAYSTACK_VERIFY_BASE = "https://api.paystack.co/transaction/verify/";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return NextResponse.json({ error: "PAYSTACK_SECRET_KEY is not configured" }, { status: 500 });

  let reference = "";
  try {
    const body = await req.json();
    reference = typeof body?.reference === "string" ? body.reference.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  if (!reference) return NextResponse.json({ error: "Reference is required" }, { status: 400 });

  await connectDB();
  const eventKey = `verify:${reference}`;
  const alreadyProcessed = await hasProcessedBillingEvent(eventKey);
  if (alreadyProcessed) {
    return NextResponse.json({
      ok: true,
      reference,
      deduped: true,
    });
  }

  let verified: any = null;
  try {
    const verifyRes = await fetch(`${PAYSTACK_VERIFY_BASE}${encodeURIComponent(reference)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
    verified = await verifyRes.json();
    if (!verifyRes.ok || !verified?.status || !verified?.data) {
      return NextResponse.json({ error: verified?.message || "Unable to verify payment" }, { status: 502 });
    }
  } catch {
    return NextResponse.json({ error: "Unable to reach payment gateway. Please retry shortly." }, { status: 502 });
  }

  const tx = verified.data;
  if (tx.status !== "success") {
    return NextResponse.json({ error: "Payment not successful", paymentStatus: tx.status }, { status: 400 });
  }

  const metadata = tx.metadata || {};
  const txUserId = metadata?.userId;
  if (txUserId && txUserId !== (session.user as any).id) {
    return NextResponse.json({ error: "Reference does not belong to current user" }, { status: 403 });
  }

  const inserted = await markBillingEventProcessed(eventKey, "verify", reference);
  if (inserted) {
    await applySuccessfulPayment({
      reference,
      source: "verify",
      userId: txUserId || (session.user as any).id,
      customerCode: tx?.customer?.customer_code,
      targetPlan: metadata?.targetPlan || "pro",
      paidAt: tx?.paid_at ? new Date(tx.paid_at) : new Date(),
    });
  }

  return NextResponse.json({
    ok: true,
    reference,
    status: tx.status,
    targetPlan: metadata?.targetPlan || "pro",
  });
}
