import Link from "next/link";
import { getServerSession } from "next-auth";
import { ArrowRight, Check, Droplets, Fish, LineChart, ShieldCheck, Waves } from "lucide-react";
import { authOptions } from "@/lib/auth";
import SignOutButton from "@/components/auth/SignOutButton";

const CORE_ITEMS = [
  "Daily feeding and mortality records",
  "Tank-level batch allocation",
  "Water quality monitoring",
  "Feed inventory and usage balance",
  "Harvest and revenue capture",
  "Reports that show what is changing",
];

const HIGHLIGHTS = [
  { icon: Fish, label: "Production truth", text: "Know how many fish are alive, where they are, and how each batch is progressing." },
  { icon: Waves, label: "Daily control", text: "Keep feeding, tank moves, and routine farm work in one operating flow." },
  { icon: Droplets, label: "Health signals", text: "Spot water-quality risk and mortality patterns before they become expensive." },
  { icon: LineChart, label: "Decision support", text: "Review margins, feed usage, and trendlines with data you can trust." },
];

const WORKFLOW = [
  { step: "01", title: "Stock clearly", desc: "Create the batch, record count, and place fish into the right tanks from day one." },
  { step: "02", title: "Log every day", desc: "Capture feed, mortality, water checks, and observations in one routine." },
  { step: "03", title: "Respond early", desc: "Use alerts, milestones, and inventory signals before problems grow." },
  { step: "04", title: "Review the cycle", desc: "See survival, feed usage, revenue, and what to improve next." },
];

const TRUST = [
  { title: "Built for real catfish workflow", desc: "The product mirrors the daily rhythm of stocking, feeding, sorting, and harvest." },
  { title: "Made for live farm use", desc: "Keep the team workflow familiar while records, reports, and planning improve around it." },
  { title: "Action-oriented", desc: "Alerts and milestones keep the next operational priority visible." },
];

const PROOF_POINTS = [
  { label: "Designed for", value: "Catfish farms in Nigeria" },
  { label: "Core promise", value: "Tighter control, fewer preventable losses" },
  { label: "Best fit", value: "Owner-led farms moving off spreadsheets" },
];

const OUTCOMES = [
  "Reduce hidden feed waste",
  "Catch mortality and water issues earlier",
  "Keep one trustworthy production record",
];

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  const isAuthenticated = Boolean(session?.user);

  return (
    <div className="min-h-screen bg-[#0d1117] text-[#e6edf3]">
      <header className="border-b border-white/10">
        <div className="max-w-[82em] mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-white/10 flex items-center justify-center">
              {/* <Fish className="w-4 h-4" /> */}
              <Waves className="w-6 h-6" />
            </div>
            <span className="font-semibold tracking-tight">AquaFarm</span>
          </div>
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <>
                <Link href="/plans" className="btn-secondary !py-2 !px-4">
                  Plans
                </Link>
                <Link href="/settings/billing" className="btn-secondary !py-2 !px-4">
                  Billing
                </Link>
                <Link href="/dashboard" className="btn-primary !py-2 !px-4">
                  Dashboard
                </Link>
                <SignOutButton className="btn-secondary !py-2 !px-4" />
              </>
            ) : (
              <>
                <Link href="/plans" className="btn-secondary !py-2 !px-4">
                  Plans
                </Link>
                <Link href="/login" className="btn-secondary !py-2 !px-4">
                  Sign in
                </Link>
                <Link href="/login" className="btn-primary !py-2 !px-4">
                  Start now
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-[82em] mx-auto px-4 pt-10 lg:pt-16 space-y-10">
        <section className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-8">
          <div className="space-y-5">
            <p className="text-xs uppercase tracking-[0.18em] text-[#8b949e]">Catfish farm operating system</p>
            <h1 className="font-display text-4xl lg:text-6xl leading-[1.05] text-white">
              Run your fish farm with tighter daily control.
            </h1>
            <p className="text-[#9ca3af] max-w-2xl">
              AquaFarm helps farmers replace scattered notebooks and spreadsheets with one clear record for feeding,
              mortality, water quality, harvest, and cycle performance.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              {isAuthenticated ? (
                <Link href="/dashboard" className="btn-primary">
                  Open workspace
                  <ArrowRight className="w-4 h-4" />
                </Link>
              ) : (
                <Link href="/login" className="btn-primary">
                  Start free
                  <ArrowRight className="w-4 h-4" />
                </Link>
              )}
              <Link href="/plans" className="btn-secondary">
                See plans
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              {PROOF_POINTS.map((item) => (
                <div key={item.label} className="rounded-xl border border-white/10 bg-[#11161d] px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[#8b949e]">{item.label}</p>
                  <p className="mt-1 text-sm text-white">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <aside className="rounded-xl border border-white/10 bg-[#161b22] p-5 space-y-4">
            <div>
              <p className="text-sm text-white font-medium">What AquaFarm helps you do</p>
              <p className="mt-1 text-xs text-[#8b949e]">Software should reduce uncertainty, not add admin work.</p>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {OUTCOMES.map((item) => (
                <div key={item} className="rounded-lg border border-white/10 bg-[#0f141b] px-3 py-2.5 text-sm text-[#d6dde5]">
                  {item}
                </div>
              ))}
            </div>
            <div className="pt-1">
              <p className="text-sm text-white font-medium">Included tools</p>
            </div>
            <div className="space-y-2">
              {CORE_ITEMS.map((item) => (
                <div key={item} className="flex items-start gap-2 text-sm text-[#9ca3af]">
                  <Check className="w-4 h-4 text-[#3fb950] mt-0.5 shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <div className="pt-2 border-t border-white/10">
              <div className="flex items-center gap-2 text-xs text-[#9ca3af]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#3fb950]" />
                Authenticated farm workspace with API protections
              </div>
            </div>
          </aside>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {HIGHLIGHTS.map(({ icon: Icon, label, text }) => (
            <article key={label} className="rounded-xl border border-white/10 bg-[#161b22] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4 text-[#58a6ff]" />
                <p className="text-sm text-white font-medium">{label}</p>
              </div>
              <p className="text-sm text-[#9ca3af]">{text}</p>
            </article>
          ))}
        </section>

        <section className="rounded-xl border border-white/10 bg-[#161b22] p-5 lg:p-6 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-white font-medium">Built around one full fish-farm cycle</h2>
            <p className="text-xs text-[#8b949e]">From stocking to harvest review</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {WORKFLOW.map((item) => (
              <div key={item.step} className="rounded-lg border border-white/10 bg-[#0d1117] p-3.5">
                <p className="font-mono text-xs text-[#58a6ff]">{item.step}</p>
                <p className="text-sm text-white font-medium mt-1">{item.title}</p>
                <p className="text-xs text-[#9ca3af] mt-1.5 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {TRUST.map((item) => (
            <div key={item.title} className="rounded-xl border border-white/10 bg-[#161b22] px-4 py-3.5">
              <p className="text-sm text-white font-medium">{item.title}</p>
              <p className="text-xs text-[#9ca3af] mt-1.5">{item.desc}</p>
            </div>
          ))}
        </section>

        <section className="rounded-xl border border-white/10 bg-gradient-to-r from-[#121820] via-[#121a23] to-[#0f151b] p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-[#8b949e]">Start simple</p>
            <h2 className="mt-2 text-2xl font-display text-white">Begin with the daily operating record.</h2>
            <p className="mt-2 max-w-2xl text-sm text-[#9ca3af]">
              Keep the workflow familiar for your team, then layer reports, alerts, and planning on top as usage grows.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href={isAuthenticated ? "/dashboard" : "/login"} className="btn-primary">
              {isAuthenticated ? "Open workspace" : "Start free"}
            </Link>
            <Link href="/plans" className="btn-secondary">
              View plans
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
