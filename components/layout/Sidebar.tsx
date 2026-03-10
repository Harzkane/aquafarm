"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard, Fish, ClipboardList, Skull,
  TrendingUp, Waves, Calendar, LogOut, Menu, X, Droplets, TestTube2, ShoppingBasket, Wheat, FileBarChart2, BookOpen, CircleDollarSign, CreditCard, Lock,
  Users,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard",   icon: LayoutDashboard, label: "Dashboard"       },
  { href: "/batches",     icon: Fish,             label: "Batches"         },
  { href: "/feeding",     icon: ClipboardList,    label: "Daily Log"       },
  { href: "/mortality",   icon: Skull,            label: "Mortality"       },
  { href: "/water-quality", icon: TestTube2,      label: "Water Quality"   },
  { href: "/feed-inventory", icon: Wheat,         label: "Feed Inventory"  },
  { href: "/harvest",     icon: ShoppingBasket,   label: "Harvest"         },
  { href: "/financials",  icon: TrendingUp,       label: "Financials"      },
  { href: "/reports",     icon: FileBarChart2,    label: "Reports"         },
  { href: "/plans",       icon: CircleDollarSign, label: "Plans & ROI"     },
  { href: "/settings/billing", icon: CreditCard,  label: "Billing"         },
  { href: "/settings/staff", icon: Users, label: "Staff Access"            },
  { href: "/settings/audit", icon: ShieldCheck, label: "Operations Audit"  },
  { href: "/playbook",    icon: BookOpen,         label: "Playbook"        },
  { href: "/tanks",       icon: Waves,            label: "Tanks"           },
  { href: "/calendar",    icon: Calendar,         label: "Calendar"        },
];

// Starter Free scope from /plans:
// - 1 active batch, up to 4 tanks
// - Daily logs + basic dashboard
// - 30-day history (handled in reports API)
// Advanced modules below are locked for Free in nav.
const FREE_LOCKED = new Set(["/financials", "/harvest", "/playbook", "/calendar"]);

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const currentPlan = ((session?.user as any)?.plan || "free") as "free" | "pro" | "commercial";
  const currentRole = ((session?.user as any)?.role || "owner") as "owner" | "staff";

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-pond-700/30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
               style={{ background: "linear-gradient(135deg,#4b5563,#064b71)" }}>
            <Droplets className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-display font-semibold text-pond-200 text-sm leading-tight">AquaFarm</p>
            <p className="text-xs text-pond-400/70 leading-tight">{(session?.user as any)?.farmName || "My Farm"}</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV.map(({ href, icon: Icon, label }) => {
          if (href === "/settings/billing" && currentRole === "staff") return null;
          if (href === "/settings/staff" && !(currentPlan === "commercial" && currentRole === "owner")) return null;
          if (href === "/settings/audit" && !(currentPlan === "commercial" && currentRole === "owner")) return null;
          const locked = currentPlan === "free" && FREE_LOCKED.has(href);
          const targetHref = locked ? "/plans" : href;
          return (
            <Link
              key={href}
              href={targetHref}
              onClick={() => setMobileOpen(false)}
              className={cn("nav-item", !locked && pathname.startsWith(href) && "active")}
              title={locked ? "Available on paid plans" : undefined}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{label}</span>
              {locked ? (
                <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-amber-400/35 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-200">
                  <Lock className="w-3 h-3" />
                  Upgrade
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-3 pb-4 border-t border-pond-700/30 pt-4">
        <div className="glass-card px-4 py-3 mb-2">
          <p className="text-xs font-medium text-pond-200 truncate">{session?.user?.name}</p>
          <p className="text-xs text-pond-200/75 truncate">{session?.user?.email}</p>
        </div>
        <button onClick={() => signOut({ callbackUrl: "/login" })}
          className="nav-item w-full text-red-400/70 hover:text-red-400 hover:bg-red-900/20">
          <LogOut className="w-4 h-4" />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 flex-shrink-0 border-r border-pond-700/30"
             style={{ background: "rgba(12, 12, 14,0.8)", backdropFilter: "blur(20px)" }}>
        <SidebarContent />
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 border-b border-pond-700/30"
           style={{ background: "rgba(12, 12, 14,0.95)", backdropFilter: "blur(20px)" }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
               style={{ background: "linear-gradient(135deg,#4b5563,#064b71)" }}>
            <Droplets className="w-4 h-4 text-white" />
          </div>
          <span className="font-display font-semibold text-pond-200 text-sm">AquaFarm</span>
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="text-pond-300 p-1">
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-30 pt-14">
          <div className="absolute inset-0 bg-pond-950/80 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 h-full border-r border-pond-700/30 overflow-y-auto"
                 style={{ background: "rgba(12, 12, 14,0.97)" }}>
            <SidebarContent />
          </aside>
        </div>
      )}
    </>
  );
}
