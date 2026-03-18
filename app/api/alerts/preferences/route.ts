import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Types } from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";

function toOptionalBool(value: unknown) {
  if (typeof value === "boolean") return value;
  return undefined;
}

function normalizePhone(value: unknown) {
  return String(value || "").replace(/[^\d+]/g, "").slice(0, 20);
}

async function getOwnerAndActor() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Unauthorized", status: 401 } as const;

  await connectDB();
  const ownerUserId = String((session.user as any).id || "");
  const actorUserId = String((session.user as any).memberUserId || ownerUserId);
  if (!Types.ObjectId.isValid(ownerUserId) || !Types.ObjectId.isValid(actorUserId)) {
    return { error: "Invalid user session", status: 400 } as const;
  }

  const [owner, actor] = await Promise.all([
    User.findById(ownerUserId).select("_id phone alertPrefs role").lean<any>(),
    User.findById(actorUserId).select("_id role").lean<any>(),
  ]);
  if (!owner || !actor) return { error: "User not found", status: 404 } as const;
  if ((actor.role || "owner") !== "owner") {
    return { error: "Only account owners can update alert channels.", status: 403 } as const;
  }

  return { owner } as const;
}

export async function GET() {
  const result = await getOwnerAndActor();
  if (!("owner" in result)) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const prefs = result.owner.alertPrefs || {};
  return NextResponse.json({
    phone: String(result.owner.phone || ""),
    alertPrefs: {
      whatsappCritical: prefs.whatsappCritical !== false,
      emailCritical: prefs.emailCritical !== false,
    },
  });
}

export async function PATCH(req: NextRequest) {
  const result = await getOwnerAndActor();
  if (!("owner" in result)) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const phone = normalizePhone(body?.phone);
  const existingPrefs = result.owner.alertPrefs || {};
  const whatsappCritical = toOptionalBool(body?.alertPrefs?.whatsappCritical);
  const emailCritical = toOptionalBool(body?.alertPrefs?.emailCritical);

  const updated = await User.findByIdAndUpdate(
    result.owner._id,
    {
      $set: {
        phone,
        alertPrefs: {
          whatsappCritical:
            whatsappCritical !== undefined
              ? whatsappCritical
              : existingPrefs.whatsappCritical !== false,
          emailCritical:
            emailCritical !== undefined
              ? emailCritical
              : existingPrefs.emailCritical !== false,
        },
      },
    },
    { new: true }
  )
    .select("phone alertPrefs")
    .lean<any>();

  return NextResponse.json({
    phone: String(updated?.phone || ""),
    alertPrefs: {
      whatsappCritical: updated?.alertPrefs?.whatsappCritical !== false,
      emailCritical: updated?.alertPrefs?.emailCritical !== false,
    },
  });
}
