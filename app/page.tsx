import Link from "next/link";
import { getServerSession } from "next-auth";
import { ArrowRight, Check, Database, Droplets, Fish, LineChart, ShieldCheck, Waves } from "lucide-react";
import { authOptions } from "@/lib/auth";
import SignOutButton from "@/components/auth/SignOutButton";

const CORE_ITEMS = [
  "Batch lifecycle tracking",
  "Tank-level fish allocation",
  "Daily log + mortality control",
  "Water quality monitoring",
  "Feed inventory balance",
  "Harvest and revenue capture",
];

const HIGHLIGHTS = [
  { icon: Fish, label: "Production", text: "Track fish count, survival rate, and growth phase by batch." },
  { icon: Waves, label: "Operations", text: "Manage tank capacity, transfers, and daily farm execution." },
  { icon: Droplets, label: "Health", text: "Detect pH/ammonia risk early with structured water logs." },
  { icon: LineChart, label: "Performance", text: "Review profitability, feed use, and operational trends." },
];

const WORKFLOW = [
  { step: "01", title: "Stock batch", desc: "Create batch records, set initial count, and map target tanks." },
  { step: "02", title: "Log operations", desc: "Capture daily feed, mortality, and water metrics in one routine." },
  { step: "03", title: "Sort by schedule", desc: "Follow calendar milestones for transfers and growth balancing." },
  { step: "04", title: "Harvest + review", desc: "Record sales and use reports to improve next-cycle ROI." },
];

const TRUST = [
  { title: "Mobile-ready", desc: "Optimized for field entry and checks on phones." },
  { title: "Protected workspace", desc: "Session-protected routes, API guards, and request controls." },
  { title: "Action-oriented", desc: "Alerts and milestones keep daily priorities visible." },
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
            <p className="text-xs uppercase tracking-[0.18em] text-[#8b949e]">Catfish farm operations platform</p>
            <h1 className="font-display text-4xl lg:text-6xl leading-[1.05] text-white">
              Run your fish farm with one clear operating system.
            </h1>
            <p className="text-[#9ca3af] max-w-2xl">
              Replace scattered spreadsheets with a secure workspace for batches, tanks, feeding, water quality, harvest,
              and financial reporting.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              {isAuthenticated ? (
                <Link href="/dashboard" className="btn-primary">
                  Open workspace
                  <ArrowRight className="w-4 h-4" />
                </Link>
              ) : (
                <Link href="/login" className="btn-primary">
                  Open workspace
                  <ArrowRight className="w-4 h-4" />
                </Link>
              )}
              <Link href="/dashboard" className="btn-secondary">
                Dashboard preview
              </Link>
            </div>
          </div>

          <aside className="rounded-xl border border-white/10 bg-[#161b22] p-5 space-y-4">
            <p className="text-sm text-white font-medium">What you get</p>
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
            <h2 className="text-white font-medium">Built from real fish-farm workflow</h2>
            <p className="text-xs text-[#8b949e]">One cycle, end to end</p>
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

        {/* <footer className="border-t border-white/10 pt-4 pb-1 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <p className="text-xs text-[#8b949e]">AquaFarm</p>
          <div className="flex items-center gap-3 text-xs text-[#8b949e]">
            <Link href="/login" className="hover:text-[#e6edf3] transition-colors">Sign in</Link>
            <span className="text-white/20">•</span>
            <Link href="/dashboard" className="hover:text-[#e6edf3] transition-colors">Dashboard</Link>
          </div>
        </footer> */}
      </main>
    </div>
  );
}
