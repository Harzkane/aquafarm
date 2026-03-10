"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

type BillingStatus = "inactive" | "trialing" | "active" | "past_due" | "canceled";
type Plan = "free" | "pro" | "commercial";

type StatusPayload = {
  plan: Plan;
  planLabel: string;
  billingStatus: BillingStatus;
};

function fallbackLabel(plan: Plan) {
  if (plan === "commercial") return "Pro+ Commercial";
  if (plan === "pro") return "Pro Founder";
  return "Free";
}

function statusTone(status: BillingStatus) {
  if (status === "active" || status === "trialing") return "text-emerald-200 border-emerald-400/35 bg-emerald-500/10";
  if (status === "past_due") return "text-amber-200 border-amber-400/35 bg-amber-500/10";
  if (status === "canceled") return "text-red-200 border-red-400/35 bg-red-500/10";
  return "text-pond-200 border-pond-600/35 bg-pond-800/20";
}

export default function CurrentPlanBadge() {
  const { data: session } = useSession();
  const sessionPlan = ((session?.user as any)?.plan || "free") as Plan;
  const sessionBilling = ((session?.user as any)?.billingStatus || "inactive") as BillingStatus;
  const [state, setState] = useState<StatusPayload>({
    plan: sessionPlan,
    planLabel: fallbackLabel(sessionPlan),
    billingStatus: sessionBilling,
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/billing/status", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok || !mounted) return;
        setState({
          plan: (data?.plan || sessionPlan) as Plan,
          planLabel: String(data?.planLabel || fallbackLabel(sessionPlan)),
          billingStatus: (data?.billingStatus || sessionBilling) as BillingStatus,
        });
      } catch {
        // Keep session fallback values if status fetch fails.
      }
    })();
    return () => {
      mounted = false;
    };
  }, [sessionBilling, sessionPlan]);

  const tone = useMemo(() => statusTone(state.billingStatus), [state.billingStatus]);
  const statusText = state.billingStatus.replace("_", " ");

  return (
    <Link
      href="/settings/billing"
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-opacity hover:opacity-90 ${tone}`}
      title="Open billing settings"
    >
      <span>{state.planLabel}</span>
      <span className="text-[10px] uppercase tracking-[0.08em] opacity-85">{statusText}</span>
    </Link>
  );
}
