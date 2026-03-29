"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, CircleDollarSign } from "lucide-react";
import CurrentPlanBadge from "@/components/billing/CurrentPlanBadge";
import { getPriorityWhatsAppHref } from "@/lib/support";
import { formatDateNg, formatDateTimeNg } from "@/lib/dates";

const PLAN_CARD_DETAILS = {
  free: [
    "1 active batch",
    "Up to 4 tanks",
    "Dashboard charts up to 30 days",
    "Community support",
  ],
  pro: [
    "Up to 5 active batches",
    "Unlimited tank records",
    "Extended dashboard history up to 90 days",
    "Priority WhatsApp support",
  ],
  commercial: [
    "Unlimited active batches",
    "Up to 5 staff seats",
    "Extended dashboard history up to 90 days",
    "Dedicated onboarding and monthly check-ins",
  ],
} as const;

type SuccessProgramPayload = {
  onboardingStatus: "not_started" | "in_progress" | "completed";
  onboardingCompletedAt: string | null;
  onboardingNotes: string;
  checkInLastAt: string | null;
  checkInNextAt: string | null;
  checkInHistory: Array<{
    date: string | null;
    notes: string;
    actorName: string;
  }>;
};

type BillingStatusPayload = {
  plan: "free" | "pro" | "commercial";
  planLabel: string;
  role?: "owner" | "staff";
  canManageStaff?: boolean;
  billingStatus: "inactive" | "trialing" | "active" | "past_due" | "canceled";
  limits: {
    maxActiveBatches: number | null;
    maxTanks: number | null;
    maxStaffUsers?: number | null;
    reportHistoryDays?: number | null;
  };
  usage?: {
    staffUsers?: number;
  };
  trialEndsAt: string | null;
  billingExpiresAt: string | null;
  cancelAtPeriodEnd: boolean;
  cancellationRequestedAt: string | null;
  canceledAt: string | null;
  scheduledPlan: "" | "free" | "pro" | "commercial";
  successProgram?: SuccessProgramPayload;
};

function BillingContent() {
  const searchParams = useSearchParams();
  const upgradedNow = searchParams.get("upgraded") === "1";
  const canceledNow = searchParams.get("canceled") === "1";
  const checkoutSuccess = searchParams.get("checkout") === "success";
  const callbackReference = searchParams.get("reference") || searchParams.get("trxref") || "";
  const [loading, setLoading] = useState(true);
  const [refreshingStatus, setRefreshingStatus] = useState(false);
  const [actionLoading, setActionLoading] = useState<
    "pro" | "commercial" | "cancel" | "downgrade" | "complete_onboarding" | "log_checkin" | null
  >(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [billing, setBilling] = useState<BillingStatusPayload | null>(null);
  const [confirmPlan, setConfirmPlan] = useState<"pro" | "commercial" | null>(null);
  const [confirmCancelMode, setConfirmCancelMode] = useState<"cancel" | "downgrade" | null>(null);
  const [successNotes, setSuccessNotes] = useState("");
  const requestedVerifyRefs = useRef<Set<string>>(new Set());
  const communitySupportHref = process.env.NEXT_PUBLIC_COMMUNITY_SUPPORT_URL || "";
  const prioritySupportHref = getPriorityWhatsAppHref(billing?.plan || "free");
  const commercialOnboardingHref = process.env.NEXT_PUBLIC_COMMERCIAL_ONBOARDING_URL || "";
  const commercialCheckinHref = process.env.NEXT_PUBLIC_COMMERCIAL_CHECKIN_URL || "";
  const isOwner = billing?.role !== "staff";

  async function loadStatus(options?: { initial?: boolean }) {
    if (options?.initial) setLoading(true);
    else setRefreshingStatus(true);
    setError("");
    try {
      const res = await fetch("/api/billing/status", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load billing status");
      setBilling(data);
    } catch (err: any) {
      setError(err?.message || "Failed to load billing status");
    } finally {
      if (options?.initial) setLoading(false);
      else setRefreshingStatus(false);
    }
  }

  useEffect(() => {
    void loadStatus({ initial: true });
  }, []);

  useEffect(() => {
    if (!checkoutSuccess || !callbackReference) return;
    if (requestedVerifyRefs.current.has(callbackReference)) return;
    requestedVerifyRefs.current.add(callbackReference);

    (async () => {
      setError("");
      setNotice("Verifying payment...");
      try {
        const res = await fetch("/api/billing/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reference: callbackReference }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Could not verify payment");
        setNotice("Payment verified. Billing status has been updated.");
        await loadStatus();
      } catch (err: any) {
        setNotice("");
        setError(err?.message || "Could not verify payment");
      }
    })();
  }, [callbackReference, checkoutSuccess]);

  async function startCheckout(plan: "pro" | "commercial") {
    if (billing?.plan === plan && (billing?.billingStatus === "active" || billing?.billingStatus === "trialing")) {
      setError(`You are already on the ${plan === "pro" ? "Pro Founder" : "Pro+ Commercial"} plan.`);
      return;
    }

    setActionLoading(plan);
    setError("");
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, returnTo: "billing" }),
      });
      const data = await res.json();
      if (!res.ok || !data?.authorizationUrl) throw new Error(data?.error || "Unable to start checkout");
      window.location.href = data.authorizationUrl;
    } catch (err: any) {
      setError(err?.message || "Unable to start checkout");
      setActionLoading(null);
    }
  }

  async function requestCancellation(mode: "cancel" | "downgrade") {
    setActionLoading(mode);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/billing/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Unable to update subscription");

      setNotice(
        mode === "cancel"
          ? "Auto-renew has been canceled. Your plan remains active until period end."
          : "Plan downgraded to Free and recurring billing disabled."
      );
      setConfirmCancelMode(null);
      await loadStatus();
    } catch (err: any) {
      setError(err?.message || "Unable to update subscription");
    } finally {
      setActionLoading(null);
    }
  }

  async function runSuccessProgramAction(action: "complete_onboarding" | "log_checkin") {
    setActionLoading(action);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/billing/success-program", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, notes: successNotes.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Unable to update success program");
      setNotice(
        action === "complete_onboarding"
          ? "Onboarding marked as completed."
          : "Monthly check-in logged successfully."
      );
      setSuccessNotes("");
      await loadStatus();
    } catch (err: any) {
      setError(err?.message || "Unable to update success program");
    } finally {
      setActionLoading(null);
    }
  }

  const isCurrentPlan = (plan: "pro" | "commercial") =>
    billing?.plan === plan && (billing?.billingStatus === "active" || billing?.billingStatus === "trialing");

  const confirmMeta =
    confirmPlan === "commercial"
      ? { title: "Pro+ Commercial", price: "N15,000 / month" }
      : { title: "Pro Founder", price: "N5,000 / month" };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-pond-300" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-semibold text-pond-100">Billing</h1>
          <p className="mt-1 text-sm text-pond-200/75">Manage your plan and subscription status.</p>
        </div>
        <div className="flex items-center gap-2">
          {refreshingStatus ? <Loader2 className="h-4 w-4 animate-spin text-pond-300" /> : null}
          <CurrentPlanBadge />
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-400/35 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
      ) : null}
      {notice ? (
        <div className="rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{notice}</div>
      ) : null}
      {upgradedNow ? (
        <div className="rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          Payment verified. Billing status has been updated.
        </div>
      ) : null}
      {canceledNow ? (
        <div className="rounded-xl border border-amber-400/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Subscription update received.
        </div>
      ) : null}

      <section className="glass-card p-5">
        <p className="text-xs uppercase tracking-wider text-pond-200/70">Current Plan</p>
        <div className="mt-2 flex items-center gap-2">
          <CircleDollarSign className="h-5 w-5 text-water-300" />
          <h2 className="text-xl font-semibold text-pond-100">{billing?.planLabel || "Free"}</h2>
        </div>
        <p className="mt-2 text-sm text-pond-200/75">
          Status: <span className="font-medium text-pond-100">{billing?.billingStatus || "inactive"}</span>
        </p>
        {billing?.trialEndsAt ? (
          <p className="text-sm text-pond-200/75">Trial ends: {formatDateNg(billing.trialEndsAt)}</p>
        ) : null}
        {billing?.billingExpiresAt ? (
          <p className="text-sm text-pond-200/75">Access valid until: {formatDateNg(billing.billingExpiresAt)}</p>
        ) : null}
        {billing?.cancelAtPeriodEnd ? (
          <p className="text-sm text-amber-200 mt-1">
            Auto-renew canceled. Downgrade to Free is scheduled at period end.
          </p>
        ) : null}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-pond-700/30 bg-black/20 px-3 py-2">
            <p className="text-xs text-pond-200/65">Active batch limit</p>
            <p className="text-sm text-pond-100">
              {billing?.limits?.maxActiveBatches == null ? "Unlimited" : billing.limits.maxActiveBatches}
            </p>
          </div>
          <div className="rounded-xl border border-pond-700/30 bg-black/20 px-3 py-2">
            <p className="text-xs text-pond-200/65">Tank limit</p>
            <p className="text-sm text-pond-100">{billing?.limits?.maxTanks == null ? "Unlimited" : billing.limits.maxTanks}</p>
          </div>
          <div className="rounded-xl border border-pond-700/30 bg-black/20 px-3 py-2">
            <p className="text-xs text-pond-200/65">Chart history</p>
            <p className="text-sm text-pond-100">
              {billing?.limits?.reportHistoryDays == null ? "Up to 90 days" : `${billing.limits.reportHistoryDays} days`}
            </p>
          </div>
          {billing?.limits?.maxStaffUsers != null ? (
            <div className="rounded-xl border border-pond-700/30 bg-black/20 px-3 py-2">
              <p className="text-xs text-pond-200/65">Staff seats</p>
              <p className="text-sm text-pond-100">
                {Number(billing?.usage?.staffUsers || 0)}/{billing.limits.maxStaffUsers}
              </p>
              {billing?.canManageStaff ? (
                <Link href="/settings/staff" className="mt-1 inline-flex text-xs text-water-200 underline underline-offset-4 hover:text-water-100">
                  Manage staff
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
        {billing?.plan === "free" && communitySupportHref ? (
          <a
            href={communitySupportHref}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex text-sm text-water-200 underline underline-offset-4 hover:text-water-100"
          >
            Community support for Starter users
          </a>
        ) : null}
        {!isOwner ? (
          <div className="mt-4 rounded-xl border border-pond-700/30 bg-black/20 px-4 py-3 text-sm text-pond-200/75">
            Billing changes are available to the account owner only. You can still view current plan status here.
          </div>
        ) : null}
      </section>

      {billing?.plan === "commercial" && isOwner ? (
        <section className="glass-card p-5">
          <h2 className="text-lg font-semibold text-pond-100">Success Program</h2>
          <p className="mt-1 text-sm text-pond-200/75">
            Track dedicated onboarding and monthly check-ins for Commercial accounts.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-pond-700/30 bg-black/20 px-3 py-2">
              <p className="text-xs text-pond-200/65">Onboarding status</p>
              <p className="text-sm capitalize text-pond-100">
                {(billing.successProgram?.onboardingStatus || "not_started").replace("_", " ")}
              </p>
            </div>
            <div className="rounded-xl border border-pond-700/30 bg-black/20 px-3 py-2">
              <p className="text-xs text-pond-200/65">Onboarding completed</p>
              <p className="text-sm text-pond-100">{formatDateTimeNg(billing.successProgram?.onboardingCompletedAt)}</p>
            </div>
            <div className="rounded-xl border border-pond-700/30 bg-black/20 px-3 py-2">
              <p className="text-xs text-pond-200/65">Next check-in</p>
              <p className="text-sm text-pond-100">{formatDateTimeNg(billing.successProgram?.checkInNextAt)}</p>
            </div>
          </div>

          <p className="mt-3 text-sm text-pond-200/75">
            Last check-in: {formatDateTimeNg(billing.successProgram?.checkInLastAt)}
          </p>

          <label htmlFor="success-notes" className="mt-4 block text-xs uppercase tracking-wider text-pond-200/70">
            Notes (optional)
          </label>
          <textarea
            id="success-notes"
            value={successNotes}
            onChange={(event) => setSuccessNotes(event.target.value)}
            maxLength={600}
            rows={3}
            className="mt-2 w-full rounded-xl border border-pond-700/40 bg-black/20 px-3 py-2 text-sm text-pond-100 outline-none transition focus:border-water-400"
            placeholder="Write onboarding or check-in summary..."
          />

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => runSuccessProgramAction("complete_onboarding")}
              disabled={actionLoading !== null || billing.successProgram?.onboardingStatus === "completed"}
              className="btn-secondary w-full disabled:cursor-not-allowed disabled:opacity-60"
            >
              {actionLoading === "complete_onboarding" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {billing.successProgram?.onboardingStatus === "completed" ? "Onboarding completed" : "Mark onboarding complete"}
            </button>
            <button
              type="button"
              onClick={() => runSuccessProgramAction("log_checkin")}
              disabled={actionLoading !== null}
              className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
            >
              {actionLoading === "log_checkin" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Log monthly check-in
            </button>
          </div>

          <div className="mt-4">
            <p className="text-xs uppercase tracking-wider text-pond-200/70">Recent check-ins</p>
            {billing.successProgram?.checkInHistory?.length ? (
              <ul className="mt-2 space-y-2">
                {billing.successProgram.checkInHistory.slice(0, 5).map((entry, idx) => (
                  <li key={`${entry.date || "date"}-${idx}`} className="rounded-xl border border-pond-700/30 bg-black/20 px-3 py-2">
                    <p className="text-xs text-pond-200/65">
                      {formatDateTimeNg(entry.date)}
                      {entry.actorName ? ` by ${entry.actorName}` : ""}
                    </p>
                    {entry.notes ? <p className="mt-1 text-sm text-pond-100">{entry.notes}</p> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-pond-200/75">No check-ins logged yet.</p>
            )}
          </div>

          {commercialOnboardingHref || commercialCheckinHref ? (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {commercialOnboardingHref ? (
                <a
                  href={commercialOnboardingHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-xl border border-water-400/35 bg-water-500/10 px-4 py-2 text-sm text-water-100 hover:bg-water-500/20"
                >
                  Book onboarding session
                </a>
              ) : null}
              {commercialCheckinHref ? (
                <a
                  href={commercialCheckinHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-500/20"
                >
                  Book monthly check-in
                </a>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {billing && billing.plan !== "free" && isOwner ? (
        <section className="glass-card p-5">
          <h2 className="text-lg font-semibold text-pond-100">Subscription Controls</h2>
          <p className="mt-1 text-sm text-pond-200/75">
            Recommended: cancel auto-renew and keep your paid access until the current period ends.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setConfirmCancelMode("cancel")}
              disabled={actionLoading !== null || billing.cancelAtPeriodEnd}
              className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
            >
              {billing.cancelAtPeriodEnd ? "Auto-renew already canceled" : "Cancel auto-renew"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmCancelMode("downgrade")}
              disabled={actionLoading !== null}
              className="w-full rounded-xl border border-red-400/25 bg-red-500/5 px-5 py-3 text-sm font-medium text-red-300 transition-all duration-200 hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Downgrade now (advanced)
            </button>
          </div>
          <p className="mt-2 text-xs text-pond-300/70">
            `Downgrade now` removes paid access immediately and should only be used if you want instant downgrade.
          </p>
          {prioritySupportHref ? (
            <a
              href={prioritySupportHref}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-500/15"
            >
              Priority WhatsApp support
            </a>
          ) : null}
        </section>
      ) : null}

      {isOwner ? (
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <article className="glass-card p-5">
          <p className="text-sm text-pond-200/75">Growth Plan</p>
          <h3 className="mt-1 text-lg font-semibold text-pond-100">Pro Founder</h3>
          <p className="mt-1 text-sm text-pond-200/70">₦5,000 / month</p>
          {isCurrentPlan("pro") ? <p className="mt-1 text-xs text-emerald-300">Current plan</p> : null}
          <ul className="mt-4 space-y-2 text-sm text-pond-200/80">
            {PLAN_CARD_DETAILS.pro.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setConfirmPlan("pro")}
            disabled={actionLoading !== null || isCurrentPlan("pro")}
            className="btn-primary mt-5 w-full disabled:cursor-not-allowed disabled:opacity-60"
          >
            {actionLoading === "pro" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isCurrentPlan("pro") ? "Current plan" : "Upgrade to Pro"}
          </button>
        </article>

        <article className="glass-card p-5">
          <p className="text-sm text-pond-200/75">Commercial Plan</p>
          <h3 className="mt-1 text-lg font-semibold text-pond-100">Pro+ Commercial</h3>
          <p className="mt-1 text-sm text-pond-200/70">₦15,000 / month</p>
          {isCurrentPlan("commercial") ? <p className="mt-1 text-xs text-emerald-300">Current plan</p> : null}
          <ul className="mt-4 space-y-2 text-sm text-pond-200/80">
            {PLAN_CARD_DETAILS.commercial.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setConfirmPlan("commercial")}
            disabled={actionLoading !== null || isCurrentPlan("commercial")}
            className="btn-secondary mt-5 w-full disabled:cursor-not-allowed disabled:opacity-60"
          >
            {actionLoading === "commercial" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isCurrentPlan("commercial") ? "Current plan" : "Upgrade to Commercial"}
          </button>
        </article>
        </section>
      ) : null}

      {confirmPlan ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            onClick={() => setConfirmPlan(null)}
            aria-label="Close confirmation"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-pond-700/40 bg-[#0f141b] p-5 shadow-2xl">
            <p className="text-xs uppercase tracking-wider text-pond-200/70">Confirm upgrade</p>
            <h3 className="mt-1 text-xl font-semibold text-pond-100">{confirmMeta.title}</h3>
            <p className="mt-1 text-sm text-pond-200/80">{confirmMeta.price}</p>
            <p className="mt-3 text-sm text-pond-200/75">
              You will be redirected to Paystack to complete payment securely.
            </p>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setConfirmPlan(null)}
                className="btn-secondary w-full"
                disabled={actionLoading !== null}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => startCheckout(confirmPlan)}
                className="btn-primary w-full"
                disabled={actionLoading !== null}
              >
                {actionLoading === confirmPlan ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Continue to Paystack
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmCancelMode ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            onClick={() => setConfirmCancelMode(null)}
            aria-label="Close cancel confirmation"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-red-400/35 bg-[#0f141b] p-5 shadow-2xl">
            <p className="text-xs uppercase tracking-wider text-red-200/70">Confirm change</p>
            <h3 className="mt-1 text-xl font-semibold text-pond-100">
              {confirmCancelMode === "cancel" ? "Cancel auto-renew" : "Downgrade to Free now"}
            </h3>
            <p className="mt-2 text-sm text-pond-200/80">
              {confirmCancelMode === "cancel"
                ? "Recurring billing will be disabled at Paystack. Your current paid access stays active until period end."
                : "Recurring billing will be disabled at Paystack and this account will be downgraded to Free immediately."}
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setConfirmCancelMode(null)}
                className="btn-secondary w-full"
                disabled={actionLoading !== null}
              >
                Keep plan
              </button>
              <button
                type="button"
                onClick={() => requestCancellation(confirmCancelMode)}
                className="w-full rounded-xl border border-red-400/35 bg-red-500/10 px-5 py-3 text-sm font-medium text-red-200 transition-all duration-200 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={actionLoading !== null}
              >
                {actionLoading === confirmCancelMode ? <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> : null}
                {confirmCancelMode === "cancel" ? "Confirm cancel auto-renew" : "Confirm downgrade"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function BillingSettingsPage() {
  return (
    <Suspense fallback={
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-pond-300" />
      </div>
    }>
      <BillingContent />
    </Suspense>
  );
}
