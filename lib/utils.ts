import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNaira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency", currency: "NGN",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(n: number) {
  return new Intl.NumberFormat("en-NG").format(n);
}

export function calcSurvivalRate(alive: number, initial: number) {
  return initial > 0 ? ((alive / initial) * 100).toFixed(1) : "0.0";
}

export function calcFCR(feedUsed: number, weightGained: number) {
  return weightGained > 0 ? (feedUsed / weightGained).toFixed(2) : "N/A";
}

export function weeksSince(date: Date) {
  const ms = Date.now() - new Date(date).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24 * 7));
}

export function getBatchPhase(weekNumber: number): {
  phase: string; color: string; next: string; nextWeek: number;
} {
  if (weekNumber <= 3)  return { phase: "Juvenile",     color: "water",  next: "Sort 1 due",    nextWeek: 3  };
  if (weekNumber <= 8)  return { phase: "Post-Juvenile", color: "pond",   next: "Sort 2 due",    nextWeek: 8  };
  if (weekNumber <= 14) return { phase: "Grower",        color: "mud",    next: "Sort 3 due",    nextWeek: 14 };
  if (weekNumber <= 17) return { phase: "Finisher",      color: "pond",   next: "Pre-harvest sort", nextWeek: 17 };
  return { phase: "Ready to Harvest", color: "pond", next: "Harvest now!", nextWeek: 18 };
}
