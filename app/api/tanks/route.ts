import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Tank } from "@/models/Tank";
import { Types } from "mongoose";
import { User } from "@/models/User";
import { getPlanConfig } from "@/lib/plans";
import { recordAuditEvent } from "@/lib/audit";

const TANK_TYPES = new Set(["tarpaulin", "half-cut", "concrete", "fiberglass"]);
const STATUSES = new Set(["active", "empty", "cleaning", "quarantine"]);

type TankPayload = {
  name: string;
  type: string;
  capacity: number;
  dimensions?: string;
  notes?: string;
  status: string;
  currentFish: number;
  targetFishCapacity: number;
};

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeOptionalText(value: unknown, maxLen: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLen);
}

function validatePayload(body: any): { ok: true; value: TankPayload } | { ok: false; error: string } {
  const name = normalizeOptionalText(body?.name, 120);
  if (!name) return { ok: false, error: "Tank name is required" };

  const type = normalizeOptionalText(body?.type, 30);
  if (!TANK_TYPES.has(type)) return { ok: false, error: "Invalid tank type" };

  const statusRaw = normalizeOptionalText(body?.status, 30) || "empty";
  if (!STATUSES.has(statusRaw)) return { ok: false, error: "Invalid tank status" };

  const capacity = Number(body?.capacity);
  if (!Number.isFinite(capacity) || capacity <= 0) {
    return { ok: false, error: "Capacity must be a positive number" };
  }

  const currentFishRaw = body?.currentFish === undefined ? 0 : Number(body?.currentFish);
  const currentFish = Math.trunc(currentFishRaw);
  if (!Number.isFinite(currentFishRaw) || currentFish < 0) {
    return { ok: false, error: "Current fish must be 0 or more" };
  }

  const targetFishRaw = body?.targetFishCapacity === undefined ? 0 : Number(body?.targetFishCapacity);
  const targetFishCapacity = Math.trunc(targetFishRaw);
  if (!Number.isFinite(targetFishRaw) || targetFishCapacity < 0) {
    return { ok: false, error: "Fish capacity cannot be negative" };
  }
  if (targetFishCapacity > 0 && currentFish > targetFishCapacity) {
    return { ok: false, error: "Current fish cannot exceed fish capacity" };
  }
  if (currentFish > 0) {
    return {
      ok: false,
      error: "Create tanks with 0 fish, then use Allocate Batch Fish to stock them.",
    };
  }

  return {
    ok: true,
    value: {
      name,
      type,
      status: statusRaw,
      capacity: Math.trunc(capacity),
      dimensions: normalizeOptionalText(body?.dimensions, 120),
      notes: normalizeOptionalText(body?.notes, 2000),
      currentFish,
      targetFishCapacity,
    },
  };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await connectDB();
    const tanks = await Tank.find({ userId: (session.user as any).id }).sort({ createdAt: 1 });
    return NextResponse.json(tanks);
  } catch {
    return NextResponse.json({ error: "Failed to load tanks" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }

  const validated = validatePayload(body);
  if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });

  try {
    await connectDB();
    const userId = (session.user as any).id;
    if (!Types.ObjectId.isValid(userId)) {
      return NextResponse.json({ error: "Invalid user session" }, { status: 400 });
    }

    const user = await User.findById(userId).select("plan").lean<any>();
    const plan = getPlanConfig(user?.plan);
    if (plan.maxTanks !== null) {
      const tankCount = await Tank.countDocuments({ userId });
      if (tankCount >= plan.maxTanks) {
        return NextResponse.json(
          {
            error: `Your ${plan.label} plan allows up to ${plan.maxTanks} tanks. Upgrade to add more.`,
            code: "PLAN_LIMIT_TANKS",
            limit: plan.maxTanks,
          },
          { status: 403 }
        );
      }
    }

    const escapedName = escapeRegex(validated.value.name);
    const existing = await Tank.findOne({
      userId,
      name: { $regex: new RegExp(`^${escapedName}$`, "i") },
    });
    if (existing) return NextResponse.json(existing);

    const workingVolume = Math.round(validated.value.capacity * 0.78);
    const tank = await Tank.create({
      ...validated.value,
      userId,
      workingVolume,
    });
    await recordAuditEvent({
      sessionUser: session.user,
      action: "create",
      resource: "tank",
      resourceId: tank._id.toString(),
      summary: `Created tank ${tank.name}`,
      meta: { capacity: tank.capacity, status: tank.status },
    }).catch(() => {});
    return NextResponse.json(tank, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create tank" }, { status: 500 });
  }
}
