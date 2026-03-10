import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { markBillingEventProcessed, applySuccessfulPayment } from "@/lib/billing";

function verifyPaystackSignature(body: string, signature: string | null) {
  const secret = process.env.PAYSTACK_WEBHOOK_SECRET || process.env.PAYSTACK_SECRET_KEY;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha512", secret).update(body).digest("hex");
  return expected === signature;
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-paystack-signature");

  if (!verifyPaystackSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: any = null;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  await connectDB();

  const eventName = event?.event;
  if (eventName === "charge.success") {
    const data = event?.data || {};
    const metadata = data?.metadata || {};
    const userId = metadata?.userId;
    const reference = data?.reference || "";
    const eventKey = `webhook:charge.success:${reference || userId || "unknown"}`;
    const inserted = await markBillingEventProcessed(eventKey, "charge.success", reference);
    if (!inserted) return NextResponse.json({ ok: true, deduped: true });

    await applySuccessfulPayment({
      source: "webhook",
      reference,
      userId,
      customerCode: data?.customer?.customer_code,
      targetPlan: metadata?.targetPlan || "pro",
      paidAt: data?.paid_at ? new Date(data.paid_at) : new Date(),
    });
    return NextResponse.json({ ok: true });
  }

  if (eventName === "invoice.payment_failed") {
    const reference = event?.data?.reference || "";
    const eventKey = `webhook:invoice.payment_failed:${reference || event?.data?.customer?.customer_code || "unknown"}`;
    const inserted = await markBillingEventProcessed(eventKey, "invoice.payment_failed", reference);
    if (!inserted) return NextResponse.json({ ok: true, deduped: true });

    const customerCode = event?.data?.customer?.customer_code;
    if (customerCode) {
      await User.findOneAndUpdate(
        { paystackCustomerCode: customerCode },
        { $set: { billingStatus: "past_due" } }
      );
    }
    return NextResponse.json({ ok: true });
  }

  if (eventName === "subscription.disable") {
    const eventKey = `webhook:subscription.disable:${event?.data?.subscription_code || event?.data?.customer?.customer_code || "unknown"}`;
    const inserted = await markBillingEventProcessed(eventKey, "subscription.disable");
    if (!inserted) return NextResponse.json({ ok: true, deduped: true });

    const customerCode = event?.data?.customer?.customer_code;
    if (customerCode) {
      await User.findOneAndUpdate(
        { paystackCustomerCode: customerCode },
        {
          $set: {
            billingStatus: "canceled",
            plan: "free",
            billingExpiresAt: new Date(),
            cancelAtPeriodEnd: false,
            canceledAt: new Date(),
            scheduledPlan: "",
          },
        }
      );
    }
    return NextResponse.json({ ok: true });
  }

  if (eventName === "subscription.create") {
    const eventKey = `webhook:subscription.create:${event?.data?.subscription_code || event?.data?.customer?.customer_code || "unknown"}`;
    const inserted = await markBillingEventProcessed(eventKey, "subscription.create");
    if (!inserted) return NextResponse.json({ ok: true, deduped: true });

    const customerCode = event?.data?.customer?.customer_code;
    if (customerCode) {
      await User.findOneAndUpdate(
        { paystackCustomerCode: customerCode },
        {
          $set: {
            billingStatus: "active",
            paystackSubscriptionCode: event?.data?.subscription_code || "",
            paystackEmailToken: event?.data?.email_token || "",
            cancelAtPeriodEnd: false,
            cancellationRequestedAt: null,
            canceledAt: null,
            scheduledPlan: "",
          },
        }
      );
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
