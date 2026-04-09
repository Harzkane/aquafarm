"use client";
import { AlertTriangle, CheckCircle2, ClipboardList, Droplets, Fish, Waves } from "lucide-react";

const GROWTH_STAGES = [
  { stage: "Fingerling", weight: "1-10g", duration: "Weeks 1-3", feedSize: "0.5-1mm", protein: "50-57%", frequency: "4-5x/day" },
  { stage: "Juvenile", weight: "10-100g", duration: "Weeks 3-8", feedSize: "1.5-2mm", protein: "45-50%", frequency: "3-4x/day" },
  { stage: "Post-Juvenile", weight: "100-300g", duration: "Weeks 8-14", feedSize: "2-3mm", protein: "40-45%", frequency: "3x/day" },
  { stage: "Grower", weight: "300-800g", duration: "Weeks 14-20", feedSize: "4-6mm", protein: "35-40%", frequency: "2-3x/day" },
  { stage: "Finisher", weight: "800g-1.5kg+", duration: "Weeks 20-26", feedSize: "6-9mm", protein: "35%", frequency: "2x/day" },
];

const MILESTONES = [
  { week: 0, title: "Stocking", note: "Start juveniles in smaller tanks for tighter monitoring and feed control." },
  { week: 3, title: "Sort 1", note: "Split obvious shooters and laggards. Move larger fish to bigger space." },
  { week: 8, title: "Sort 2", note: "Major grading to reduce cannibalism and feed competition." },
  { week: 14, title: "Sort 3", note: "Mid-cycle rebalancing and density correction." },
  { week: 17, title: "Sort 4", note: "Pre-harvest selection and prep." },
  { week: 18, title: "Harvest Window", note: "Target market-ready fish and monitor price/kg opportunities." },
];

const SAFE_RANGES = [
  { metric: "pH", safe: "6.5 - 8.0", action: "If < 6.5 or > 8.0: partial water change, aerate, recheck in 2-4h." },
  { metric: "Ammonia", safe: "< 0.5 ppm", action: "If high: reduce feed, increase water exchange, check dead feed pockets." },
  { metric: "Temperature", safe: "26 - 30°C", action: "If high/low: adjust water depth, shading, and aeration schedule." },
  { metric: "Dissolved O2", safe: "> 5 mg/L", action: "If low: increase aeration immediately; reduce stress/handling." },
];

const QUICK_ACTIONS = [
  { trigger: "Mortality spike in 24h", response: "Stop overfeeding, test water immediately, isolate weak fish, log suspected cause." },
  { trigger: "Feed refusal", response: "Check ammonia + DO first, verify feed freshness, reduce ration for one session." },
  { trigger: "Frequent surfacing/gasping", response: "Aerate now, partial water exchange, inspect pump/air stone." },
  { trigger: "Uneven growth", response: "Run sorting cycle, separate by size class, rebalance stocking density." },
];

const STARTUP_PATTERNS = [
  {
    title: "Pattern A: Small-Tank Start",
    when: "Best for close monitoring in early juvenile phase",
    steps: "Start in 5,000L + 3,500L halves, then move to tarpaulin at Week 3-4 after Sort 1.",
  },
  {
    title: "Pattern B: Tarpaulin Start",
    when: "Best if aeration and observation discipline are strong",
    steps: "Start all fish together in tarpaulin; redistribute only after Week 8 major sorting.",
  },
];

const WATER_CHANGE_SCHEDULE = [
  { tank: "Tarpaulin", phase1: "Every 3 days (20-30%)", phase2: "Every 2-3 days (30%)", phase3: "Every 2 days (30%)" },
  { tank: "5,000L half", phase1: "N/A at start", phase2: "Every 2-3 days (25-30%)", phase3: "Every 2 days (30%)" },
  { tank: "3,500-4,000L half", phase1: "N/A at start", phase2: "Every 2 days (30%)", phase3: "Every 2 days (30%)" },
  { tank: "2,500L half", phase1: "N/A at start", phase2: "Every 2 days (30-35%)", phase3: "Daily if crowded (25%)" },
];

const BENCHMARKS = [
  { label: "Weekly sorting impact", value: "Cannibalism ~2% vs ~40% unsorted", tone: "text-success" },
  { label: "Expected survival target", value: "≈86-90% with strong management", tone: "text-water-300" },
  { label: "Cycle ROI reference", value: "≈140%-280% (market/management dependent)", tone: "text-mud-300" },
];

export default function PlaybookPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-pond-100">Farm Playbook</h1>
        <p className="text-pond-200/75 text-sm mt-1">Use this as a working field reference for stocking, feeding, water checks, sorting, and quick response decisions.</p>
      </div>

      <div className="glass-card p-5 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="section-title !text-base">How To Use This Page</h2>
          <p className="text-xs text-pond-200/65">Reference first, then log what actually happened in the product</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-pond-200/75">
          <div className="rounded-xl p-3" style={{ background: "rgba(12, 12, 14,0.5)", border: "1px solid rgba(148, 163, 184,0.12)" }}>
            <p className="text-xs uppercase tracking-wider text-pond-300 mb-1.5">Plan The Day</p>
            <p>Check growth stage, milestone timing, and water-change expectations before making stocking or feeding decisions.</p>
          </div>
          <div className="rounded-xl p-3" style={{ background: "rgba(12, 12, 14,0.5)", border: "1px solid rgba(148, 163, 184,0.12)" }}>
            <p className="text-xs uppercase tracking-wider text-pond-300 mb-1.5">Respond Faster</p>
            <p>Use the quick-response and safe-range sections when something feels off on the farm and you need a first next step.</p>
          </div>
          <div className="rounded-xl p-3" style={{ background: "rgba(12, 12, 14,0.5)", border: "1px solid rgba(148, 163, 184,0.12)" }}>
            <p className="text-xs uppercase tracking-wider text-pond-300 mb-1.5">Keep Records Separate</p>
            <p>This page is guidance only. Record actual mortality, water readings, feeding, harvest, and reports in their own screens.</p>
          </div>
        </div>
      </div>

      <div className="glass-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Fish className="w-4 h-4 text-water-300" />
          <h2 className="section-title !text-base">Growth Stage Guide</h2>
        </div>
        <p className="text-xs text-pond-200/70">Use this table to match feed size and frequency to the stage your fish are actually in, not just the calendar week.</p>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Stage</th>
                <th>Weight</th>
                <th>Duration</th>
                <th>Feed Size</th>
                <th>Protein</th>
                <th>Frequency</th>
              </tr>
            </thead>
            <tbody>
              {GROWTH_STAGES.map((row) => (
                <tr key={row.stage}>
                  <td className="text-xs">{row.stage}</td>
                  <td className="font-mono text-xs">{row.weight}</td>
                  <td className="text-xs">{row.duration}</td>
                  <td className="font-mono text-xs">{row.feedSize}</td>
                  <td className="font-mono text-xs">{row.protein}</td>
                  <td className="text-xs">{row.frequency}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Waves className="w-4 h-4 text-pond-300" />
            <h2 className="section-title !text-base">Tank Setup Principles</h2>
          </div>
          <p className="text-xs text-pond-200/70">These are the basic setup habits that reduce avoidable stress, leaks, and handling losses.</p>
          <ul className="space-y-2 text-sm text-pond-200/80">
            <li className="rounded-xl p-3" style={{ background: "rgba(12, 12, 14,0.5)", border: "1px solid rgba(148, 163, 184,0.12)" }}>
              Fill cut tanks to about <span className="font-semibold text-pond-100">75-80%</span> working depth to keep safe headspace.
            </li>
            <li className="rounded-xl p-3" style={{ background: "rgba(12, 12, 14,0.5)", border: "1px solid rgba(148, 163, 184,0.12)" }}>
              Smooth all cut edges before stocking to prevent injury during sorting and nighttime jumps.
            </li>
            <li className="rounded-xl p-3" style={{ background: "rgba(12, 12, 14,0.5)", border: "1px solid rgba(148, 163, 184,0.12)" }}>
              Keep aeration redundancy and inspect seams/frames routinely for leaks and stress points.
            </li>
          </ul>
        </div>

        <div className="glass-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-mud-300" />
            <h2 className="section-title !text-base">Production Milestones</h2>
          </div>
          <p className="text-xs text-pond-200/70">These checkpoints help you time sorts and harvest prep before uneven growth or crowding becomes expensive.</p>
          <div className="space-y-2">
            {MILESTONES.map((m) => (
              <div
                key={`${m.week}-${m.title}`}
                className="rounded-xl p-3 flex items-start gap-3"
                style={{ background: "rgba(12, 12, 14,0.5)", border: "1px solid rgba(148, 163, 184,0.12)" }}
              >
                <span className="badge badge-water shrink-0">Week {m.week}</span>
                <div>
                  <p className="text-sm text-pond-100 font-medium">{m.title}</p>
                  <p className="text-xs text-pond-200/70 mt-0.5">{m.note}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="glass-card p-5 space-y-3">
        <h2 className="section-title !text-base">Startup Strategy Patterns</h2>
        <p className="text-xs text-pond-200/70">Choose the startup pattern that best fits your tank layout, observation strength, and aeration reliability.</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {STARTUP_PATTERNS.map((row) => (
            <div key={row.title} className="rounded-xl p-3" style={{ background: "rgba(12, 12, 14,0.5)", border: "1px solid rgba(148, 163, 184,0.12)" }}>
              <p className="text-sm text-pond-100 font-medium">{row.title}</p>
              <p className="text-xs text-pond-200/70 mt-1">{row.when}</p>
              <p className="text-xs text-pond-200/80 mt-1.5">{row.steps}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Droplets className="w-4 h-4 text-water-300" />
          <h2 className="section-title !text-base">Water Quality Safe Ranges</h2>
        </div>
        <p className="text-xs text-pond-200/70">Use these ranges as fast field checks when fish behavior, smell, or appetite suggests water trouble.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {SAFE_RANGES.map((row) => (
            <div
              key={row.metric}
              className="rounded-xl p-3"
              style={{ background: "rgba(12, 12, 14,0.5)", border: "1px solid rgba(148, 163, 184,0.12)" }}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-pond-100 font-medium">{row.metric}</p>
                <span className="badge badge-green">{row.safe}</span>
              </div>
              <p className="text-xs text-pond-200/70 mt-1.5">{row.action}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-card p-5 space-y-3">
        <h2 className="section-title !text-base">Water Change Schedule (Reference)</h2>
        <p className="text-xs text-pond-200/70">Treat this as a starting point. Actual frequency should still respond to density, weather, and water readings.</p>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tank</th>
                <th>Phase 1</th>
                <th>Phase 2</th>
                <th>Phase 3</th>
              </tr>
            </thead>
            <tbody>
              {WATER_CHANGE_SCHEDULE.map((row) => (
                <tr key={row.tank}>
                  <td className="text-xs">{row.tank}</td>
                  <td className="text-xs">{row.phase1}</td>
                  <td className="text-xs">{row.phase2}</td>
                  <td className="text-xs">{row.phase3}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-warning" />
          <h2 className="section-title !text-base">Quick Response Protocols</h2>
        </div>
        <p className="text-xs text-pond-200/70">These are first-response actions meant to stabilize the situation before you investigate deeper.</p>
        <div className="space-y-2">
          {QUICK_ACTIONS.map((row) => (
            <div
              key={row.trigger}
              className="rounded-xl p-3"
              style={{ background: "rgba(12, 12, 14,0.5)", border: "1px solid rgba(148, 163, 184,0.12)" }}
            >
              <p className="text-sm text-pond-100 font-medium">{row.trigger}</p>
              <p className="text-xs text-pond-200/70 mt-1">{row.response}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-card p-4 flex items-start gap-3">
        <CheckCircle2 className="w-4 h-4 text-success mt-0.5" />
        <div>
          <p className="text-sm text-pond-200/80">Use this page as your operating reference. Keep actual farm records in Daily Log, Water Quality, Feed Inventory, Harvest, and Reports so the numbers stay trustworthy.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
            {BENCHMARKS.map((row) => (
              <div key={row.label} className="rounded-lg px-3 py-2" style={{ background: "rgba(12, 12, 14,0.5)" }}>
                <p className="text-[11px] text-pond-200/65">{row.label}</p>
                <p className={`text-xs mt-0.5 ${row.tone}`}>{row.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
