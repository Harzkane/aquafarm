"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  CircleDollarSign,
  Fish,
  Loader2,
  ShieldCheck,
  TrendingUp,
  Waves,
} from "lucide-react";
import SignOutButton from "@/components/auth/SignOutButton";

const PLAN_FEATURES = {
  free: [
    "1 active batch",
    "Up to 4 tanks",
    "Daily logs + basic dashboard",
    "30-day history",
    "Community support",
  ],
  pro: [
    "Up to 5 active batches",
    "Unlimited logs and tank records",
    "Calendar reminders + harvest channels",
    "Full reports + export",
    "Priority WhatsApp support",
  ],
  commercial: [
    "Unlimited batches",
    "Multi-user staff access",
    "Advanced reporting",
    "Operational audit visibility",
    "Dedicated onboarding + monthly check-in",
  ],
};

const FAQS = [
  {
    q: "Can I start free and upgrade later?",
    a: "Yes. You can start on Free, unlock Pro trial, and upgrade only when value is clear on your farm.",
  },
  {
    q: "Do you support Nigerian payments?",
    a: "Yes. Plans are priced in naira and integrated with local payment flows for smooth checkout.",
  },
  {
    q: "What happens when trial ends?",
    a: "You keep access on the Free plan. Your data stays safe and you can upgrade at any time.",
  },
];

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-white/15 bg-white/[0.03] px-3.5 py-1.5">
      <p className="text-[10px] uppercase tracking-[0.14em] text-[#94a3b8]">{label}</p>
      <p className="text-sm font-medium text-white">{value}</p>
    </div>
  );
}

function PlansContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const checkoutFlag = searchParams.get("checkout");
  const callbackReference = searchParams.get("reference") || searchParams.get("trxref") || "";
  const [fishCount, setFishCount] = useState(1000);
  const [avgValue, setAvgValue] = useState(700);
  const [savePct, setSavePct] = useState(2);
  const [checkoutPlan, setCheckoutPlan] = useState<"pro" | "commercial" | null>(null);
  const [apiError, setApiError] = useState("");
  const [verifyState, setVerifyState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [verifyMessage, setVerifyMessage] = useState("");
  const [verifiedRef, setVerifiedRef] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<"free" | "pro" | "commercial">("free");
  const [billingState, setBillingState] = useState<"inactive" | "trialing" | "active" | "past_due" | "canceled">("inactive");
  const [confirmPlan, setConfirmPlan] = useState<"pro" | "commercial" | null>(null);
  const requestedRefs = useRef<Set<string>>(new Set());
  const didRedirectAfterSuccess = useRef(false);
  const whatsappNumber = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "").replace(/\D/g, "");
  const whatsappMessage = encodeURIComponent(
    process.env.NEXT_PUBLIC_WHATSAPP_MESSAGE || "Hello AquaFarm team, I need help choosing a plan."
  );
  const whatsappHref = whatsappNumber ? `https://wa.me/${whatsappNumber}?text=${whatsappMessage}` : "";

  const roi = useMemo(() => {
    const recoveredFish = (fishCount * savePct) / 100;
    const recoveredValue = Math.round(recoveredFish * avgValue);
    return { recoveredFish, recoveredValue };
  }, [avgValue, fishCount, savePct]);

  async function startCheckout(plan: "pro" | "commercial") {
    if (isAuthenticated && currentPlan === plan && (billingState === "active" || billingState === "trialing")) {
      setApiError(`You are already on the ${plan === "pro" ? "Pro Founder" : "Pro+ Commercial"} plan.`);
      return;
    }

    setApiError("");
    setCheckoutPlan(plan);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, returnTo: "plans" }),
      });
      const data = await res.json();

      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!res.ok || !data?.authorizationUrl) {
        throw new Error(data?.error || "Checkout initialization failed");
      }
      window.location.href = data.authorizationUrl;
    } catch (err: any) {
      setApiError(err?.message || "Checkout initialization failed");
    } finally {
      setCheckoutPlan(null);
    }
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        const data = await res.json();
        if (!mounted) return;
        const authed = Boolean(data?.user);
        setIsAuthenticated(authed);

        if (authed) {
          const billingRes = await fetch("/api/billing/status", { cache: "no-store" });
          if (billingRes.ok) {
            const billing = await billingRes.json();
            if (!mounted) return;
            setCurrentPlan((billing?.plan as any) || "free");
            setBillingState((billing?.billingStatus as any) || "inactive");
          }
        }
      } catch {
        if (!mounted) return;
        setIsAuthenticated(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (checkoutFlag !== "success" || !callbackReference) return;
    if (verifiedRef === callbackReference) return;
    if (requestedRefs.current.has(callbackReference)) return;
    requestedRefs.current.add(callbackReference);

    (async () => {
      setVerifyState("loading");
      setVerifyMessage("Verifying payment...");
      try {
        const res = await fetch("/api/billing/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reference: callbackReference }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Could not verify payment");
        setVerifyState("success");
        setVerifyMessage("Payment verified. Your plan has been activated. Redirecting to billing...");
        setVerifiedRef(callbackReference);
      } catch (err: any) {
        setVerifyState("error");
        setVerifyMessage(err?.message || "Verification failed. Contact support with your payment reference.");
        setVerifiedRef(callbackReference);
      }
    })();
  }, [callbackReference, checkoutFlag, verifiedRef]);

  useEffect(() => {
    if (verifyState !== "success") return;
    if (didRedirectAfterSuccess.current) return;
    didRedirectAfterSuccess.current = true;

    const timer = setTimeout(() => {
      router.replace("/settings/billing?upgraded=1");
    }, 1200);

    return () => clearTimeout(timer);
  }, [router, verifyState]);

  const isPlanActive = (plan: "pro" | "commercial") =>
    isAuthenticated && currentPlan === plan && (billingState === "active" || billingState === "trialing");

  const confirmMeta =
    confirmPlan === "commercial"
      ? { title: "Pro+ Commercial", price: "N15,000 / month" }
      : { title: "Pro Founder", price: "N5,000 / month" };

  return (
    <div className="min-h-screen bg-[#0b0f13] text-[#e6edf3]">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-24 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-[#00a8f0]/10 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-72 w-72 rounded-full bg-[#4b5563]/15 blur-3xl" />
      </div>

      <header className="border-b border-white/10">
        <div className="mx-auto flex w-full max-w-[84rem] items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white/10">
              <Waves className="h-5 w-5" />
            </div>
            <span className="font-semibold tracking-tight">AquaFarm</span>
          </Link>
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <>
                <Link href="/settings/billing" className="btn-secondary !px-4 !py-2">
                  Billing
                </Link>
                <Link href="/dashboard" className="btn-primary !px-4 !py-2">
                  Dashboard
                </Link>
                <SignOutButton className="btn-secondary !px-4 !py-2" />
              </>
            ) : (
              <>
                <Link href="/login" className="btn-secondary !px-4 !py-2">
                  Sign in
                </Link>
                <Link href="/login" className="btn-primary !px-4 !py-2">
                  Start free
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="relative mx-auto w-full max-w-[84rem] space-y-8 px-4 pb-14 pt-10 lg:space-y-10 lg:pt-14">
        {verifyState !== "idle" ? (
          <div
            className={`rounded-xl border p-3 text-sm ${verifyState === "success"
                ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-200"
                : verifyState === "loading"
                  ? "border-blue-400/35 bg-blue-500/10 text-blue-100"
                  : "border-red-400/35 bg-red-500/10 text-red-200"
              }`}
          >
            {verifyState === "loading" ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> : null}
            {verifyMessage}
          </div>
        ) : null}

        <section className="grid grid-cols-1 gap-6 rounded-2xl border border-white/10 bg-gradient-to-br from-[#131a22] to-[#0f141b] p-6 lg:grid-cols-[1.15fr_0.85fr] lg:p-8">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[#9aa6b2]">Plans & ROI</p>
            <h1 className="font-display text-4xl leading-[1.05] text-white lg:text-6xl">
              Run a More Profitable Catfish Cycle
            </h1>
            <p className="max-w-2xl text-[#b7c1cb]">
              Track feed, mortality, water quality, and harvest profit in one place. Built for Nigerian fish farms that
              want fewer losses and stronger margins.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              {isAuthenticated ? (
                <Link href="/dashboard" className="btn-primary">
                  Open dashboard
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <Link href="/login" className="btn-primary">
                  Start free
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
              <a href="#plans" className="btn-secondary">
                See plans
              </a>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <StatPill label="Currency" value="Naira billing" />
              <StatPill label="Support" value="WhatsApp onboarding" />
              <StatPill label="Built" value="For Nigerian farms" />
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#0c1117] p-5">
            <p className="text-sm font-medium text-white">Why farmers pay</p>
            <div className="mt-4 space-y-3">
              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                <div className="mb-1.5 flex items-center gap-2 text-white">
                  <Fish className="h-4 w-4 text-[#5ab5ff]" />
                  <span className="text-sm font-medium">Reduce feed waste</span>
                </div>
                <p className="text-sm text-[#a8b3bf]">Track feed entry against stock and prevent hidden overfeeding cost.</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                <div className="mb-1.5 flex items-center gap-2 text-white">
                  <ShieldCheck className="h-4 w-4 text-[#7dd3a8]" />
                  <span className="text-sm font-medium">Catch mortality earlier</span>
                </div>
                <p className="text-sm text-[#a8b3bf]">Daily logs reveal bad trends before they become expensive losses.</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                <div className="mb-1.5 flex items-center gap-2 text-white">
                  <TrendingUp className="h-4 w-4 text-[#f6c665]" />
                  <span className="text-sm font-medium">Improve harvest margins</span>
                </div>
                <p className="text-sm text-[#a8b3bf]">Know true cost/fish and make better timing and sales-channel decisions.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="plans" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="section-title">Choose Your Plan</h2>
            <p className="text-xs uppercase tracking-[0.14em] text-[#95a2af]">Free to start, pay when value is proven</p>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <article className="rounded-2xl border border-white/10 bg-[#111821] p-5">
              <p className="text-sm text-[#b8c3cf]">Starter</p>
              <h3 className="mt-1 text-2xl font-semibold text-white">Free</h3>
              <p className="mt-1 text-sm text-[#8ea0b3]">For owner-operated farms starting digital records.</p>
              <ul className="mt-4 space-y-2.5">
                {PLAN_FEATURES.free.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-[#c8d3df]">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#6cc7ff]" />
                    {item}
                  </li>
                ))}
              </ul>
              {isAuthenticated ? (
                <Link href="/dashboard" className="btn-secondary mt-5 w-full">
                  Go to dashboard
                </Link>
              ) : (
                <Link href="/login" className="btn-secondary mt-5 w-full">
                  Create free account
                </Link>
              )}
            </article>

            <article className="relative rounded-2xl border border-[#5ab5ff]/45 bg-gradient-to-b from-[#122131] to-[#101923] p-5 shadow-[0_0_0_1px_rgba(90,181,255,0.15)]">
              <div className="mb-2 inline-flex items-center gap-1 rounded-full border border-[#7ac4ff]/30 bg-[#5ab5ff]/15 px-2.5 py-1 text-xs text-[#a8d9ff]">
                <BadgeCheck className="h-3.5 w-3.5" />
                Recommended
              </div>
              <p className="text-sm text-[#b8c3cf]">Growth</p>
              <h3 className="mt-1 text-2xl font-semibold text-white">Pro Founder</h3>
              <p className="mt-1 text-sm text-[#8ea0b3]">₦5,000/month for first 100 farms.</p>
              {isPlanActive("pro") ? (
                <p className="mt-1 text-xs text-emerald-300">Current plan</p>
              ) : null}
              <ul className="mt-4 space-y-2.5">
                {PLAN_FEATURES.pro.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-[#c8d3df]">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#8cd2ff]" />
                    {item}
                  </li>
                ))}
              </ul>
              {isAuthenticated ? (
                <Link href="/dashboard" className="btn-primary mt-5 w-full">
                  Open dashboard
                </Link>
              ) : (
                <Link href="/login" className="btn-primary mt-5 w-full">
                  Start free first
                </Link>
              )}
              <button
                type="button"
                onClick={() => setConfirmPlan("pro")}
                disabled={checkoutPlan !== null || isPlanActive("pro")}
                className="btn-primary mt-2 w-full disabled:cursor-not-allowed disabled:opacity-60"
              >
                {checkoutPlan === "pro" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isPlanActive("pro") ? "Current plan" : "Start Pro trial"}
              </button>
            </article>

            <article className="rounded-2xl border border-white/10 bg-[#111821] p-5">
              <p className="text-sm text-[#b8c3cf]">Commercial</p>
              <h3 className="mt-1 text-2xl font-semibold text-white">Pro+ Commercial</h3>
              <p className="mt-1 text-sm text-[#8ea0b3]">₦15,000/month for larger operations.</p>
              {isPlanActive("commercial") ? (
                <p className="mt-1 text-xs text-emerald-300">Current plan</p>
              ) : null}
              <ul className="mt-4 space-y-2.5">
                {PLAN_FEATURES.commercial.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-[#c8d3df]">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#7dd3a8]" />
                    {item}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => setConfirmPlan("commercial")}
                disabled={checkoutPlan !== null || isPlanActive("commercial")}
                className="btn-secondary mt-5 w-full disabled:cursor-not-allowed disabled:opacity-60"
              >
                {checkoutPlan === "commercial" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isPlanActive("commercial")
                  ? "Current plan"
                  : isAuthenticated
                    ? "Upgrade to Commercial"
                    : "Sign in to upgrade"}
              </button>
            </article>
          </div>
          {apiError ? (
            <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{apiError}</div>
          ) : null}
        </section>

        <section className="grid grid-cols-1 gap-4 rounded-2xl border border-white/10 bg-[#10161e] p-5 lg:grid-cols-[1fr_0.9fr]">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-3 py-1 text-xs text-[#abc4d8]">
              <CircleDollarSign className="h-3.5 w-3.5" />
              ROI Calculator
            </div>
            <h2 className="section-title">A Small Fee Can Save a Full Cycle</h2>
            <p className="mt-2 max-w-xl text-sm text-[#9fb0c0]">
              Use your numbers. If better tracking saves even a small mortality percentage, subscription cost is usually
              recovered quickly.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="text-sm text-[#bfd0de]">
                Fish in batch
                <input
                  type="number"
                  min={100}
                  step={50}
                  value={fishCount}
                  onChange={(e) => setFishCount(Math.max(0, Number(e.target.value) || 0))}
                  className="field mt-1"
                />
              </label>
              <label className="text-sm text-[#bfd0de]">
                Avg value per fish (₦)
                <input
                  type="number"
                  min={100}
                  step={50}
                  value={avgValue}
                  onChange={(e) => setAvgValue(Math.max(0, Number(e.target.value) || 0))}
                  className="field mt-1"
                />
              </label>
              <label className="text-sm text-[#bfd0de]">
                Mortality reduced (%)
                <input
                  type="number"
                  min={1}
                  max={50}
                  step={1}
                  value={savePct}
                  onChange={(e) => setSavePct(Math.min(50, Math.max(1, Number(e.target.value) || 1)))}
                  className="field mt-1"
                />
              </label>
            </div>
          </div>
          <div className="flex flex-col justify-between rounded-xl border border-white/10 bg-[#0c1218] p-4">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-[#8ca0b4]">Estimated value recovered</p>
              <p className="mt-2 text-3xl font-semibold text-white">₦{roi.recoveredValue.toLocaleString()}</p>
              <p className="mt-1 text-sm text-[#9fb0c0]">
                Approx. {Math.round(roi.recoveredFish)} extra fish retained by tighter monitoring.
              </p>
            </div>
            <div className="mt-4 rounded-lg border border-emerald-400/20 bg-emerald-500/10 p-3">
              <p className="text-sm text-emerald-200">
                If this gain is achieved once in a cycle, it can cover many months of Pro subscription.
              </p>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {FAQS.map((item) => (
            <article key={item.q} className="rounded-xl border border-white/10 bg-[#10161e] p-4">
              <h3 className="text-sm font-semibold text-white">{item.q}</h3>
              <p className="mt-1.5 text-sm text-[#9db0c1]">{item.a}</p>
            </article>
          ))}
        </section>

        <section className="rounded-2xl border border-white/10 bg-gradient-to-r from-[#131c24] via-[#101821] to-[#121720] p-6 text-center">
          <p className="text-xs uppercase tracking-[0.14em] text-[#95a7b8]">Founder Offer</p>
          <h2 className="mt-2 font-display text-3xl text-white">Start Free. Upgrade After You See Results.</h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-[#aab8c7]">
            Join early, lock in founder pricing, and run your next cycle with tighter operational control.
          </p>
          <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
            {isAuthenticated ? (
              <Link href="/dashboard" className="btn-primary">
                Open dashboard
              </Link>
            ) : (
              <Link href="/login" className="btn-primary">
                Create free account
              </Link>
            )}
            <a
              href={whatsappHref || "#"}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={!whatsappHref}
              className={`btn-secondary ${!whatsappHref ? "pointer-events-none opacity-60" : ""}`}
            >
              Talk on WhatsApp
            </a>
          </div>
        </section>

        {confirmPlan ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button
              type="button"
              onClick={() => setConfirmPlan(null)}
              aria-label="Close confirmation"
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
            <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/15 bg-[#0f141b] p-5 shadow-2xl">
              <p className="text-xs uppercase tracking-wider text-[#9fb0c0]">Confirm upgrade</p>
              <h3 className="mt-1 text-xl font-semibold text-white">{confirmMeta.title}</h3>
              <p className="mt-1 text-sm text-[#b8c3cf]">{confirmMeta.price}</p>
              <p className="mt-3 text-sm text-[#a8b3bf]">
                You will be redirected to Paystack to complete payment securely.
              </p>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setConfirmPlan(null)}
                  className="btn-secondary w-full"
                  disabled={checkoutPlan !== null}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => startCheckout(confirmPlan)}
                  className="btn-primary w-full"
                  disabled={checkoutPlan !== null}
                >
                  {checkoutPlan === confirmPlan ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Continue to Paystack
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

export default function PlansPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0b0f13] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-white/50" />
      </div>
    }>
      <PlansContent />
    </Suspense>
  );
}
