import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { Types } from "mongoose";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { getPlanConfig } from "@/lib/plans";
import { recordAuditEvent } from "@/lib/audit";

async function getCommercialOwnerFromSession() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Unauthorized", status: 401 } as const;

  await connectDB();
  const actorId = (session.user as any).memberUserId || (session.user as any).id;
  if (!Types.ObjectId.isValid(actorId)) return { error: "Invalid user session", status: 400 } as const;

  const actor = await User.findById(actorId).select("role plan farmName");
  if (!actor) return { error: "User not found", status: 404 } as const;
  const actorRole = actor.role === "staff" ? "staff" : "owner";
  if (actorRole !== "owner") return { error: "Only account owners can manage staff.", status: 403 } as const;
  const plan = getPlanConfig(actor.plan);
  if (plan.key !== "commercial") {
    return { error: "Staff access is available on Commercial plan only.", status: 403 } as const;
  }
  if (plan.maxStaffUsers === null || plan.maxStaffUsers <= 0) {
    return { error: "Staff access is not enabled for this plan.", status: 403 } as const;
  }

  return { owner: actor, plan, session } as const;
}

export async function GET() {
  const ownerResult = await getCommercialOwnerFromSession();
  if (!("owner" in ownerResult)) {
    return NextResponse.json({ error: ownerResult.error }, { status: ownerResult.status });
  }

  const staff = await User.find({
    role: "staff",
    farmOwnerId: ownerResult.owner._id,
  })
    .select("name email isActive createdAt")
    .sort({ createdAt: -1 })
    .lean<any[]>();

  return NextResponse.json({
    staff,
    limits: {
      maxStaffUsers: ownerResult.plan?.maxStaffUsers || 0,
    },
    usage: {
      staffUsers: staff.length,
    },
  });
}

export async function POST(req: NextRequest) {
  const ownerResult = await getCommercialOwnerFromSession();
  if (!("owner" in ownerResult)) {
    return NextResponse.json({ error: ownerResult.error }, { status: ownerResult.status });
  }
  const maxStaffUsers = ownerResult.plan?.maxStaffUsers || 0;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const name = String(body?.name || "").trim();
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");

  if (!name) return NextResponse.json({ error: "Staff name is required" }, { status: 400 });
  if (!email || !email.includes("@")) return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  if (password.length < 6) return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });

  const existingCount = await User.countDocuments({
    role: "staff",
    farmOwnerId: ownerResult.owner._id,
  });
  if (existingCount >= maxStaffUsers) {
    return NextResponse.json(
      {
        error: `Commercial plan supports up to ${maxStaffUsers} staff users.`,
        code: "PLAN_LIMIT_STAFF_USERS",
        limit: maxStaffUsers,
      },
      { status: 403 }
    );
  }

  const existing = await User.findOne({ email });
  if (existing) return NextResponse.json({ error: "Email already registered" }, { status: 409 });

  const hashed = await bcrypt.hash(password, 12);
  const created = await User.create({
    name,
    email,
    password: hashed,
    farmName: ownerResult.owner.farmName || "My Catfish Farm",
    location: "Abuja, Nigeria",
    role: "staff",
    farmOwnerId: ownerResult.owner._id,
    isActive: true,
    plan: "free",
    billingStatus: "inactive",
  });

  await recordAuditEvent({
    sessionUser: ownerResult.session!.user,
    action: "create",
    resource: "staff_user",
    resourceId: created._id.toString(),
    summary: `Added staff user ${created.email}`,
    meta: { name: created.name, email: created.email },
  }).catch(() => { });

  return NextResponse.json(
    {
      staff: {
        _id: created._id.toString(),
        name: created.name,
        email: created.email,
        isActive: created.isActive,
        createdAt: created.createdAt,
      },
    },
    { status: 201 }
  );
}
