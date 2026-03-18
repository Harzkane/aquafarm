type MaybeNumber = number | string | null | undefined;

export type FeedIdentity = {
  brand: string;
  pelletSizeMm: number | null;
};

export type FeedPurchaseLike = {
  date?: string | Date;
  brand?: string;
  pelletSizeMm?: MaybeNumber;
  bagSizeKg?: MaybeNumber;
  bags?: MaybeNumber;
  totalKg?: MaybeNumber;
  unitPrice?: MaybeNumber;
  totalCost?: MaybeNumber;
  supplier?: string;
  notes?: string;
  _id?: string;
};

export type FeedLogLike = {
  date?: string | Date;
  feedGiven?: MaybeNumber;
  feedType?: string;
  feedBrand?: string;
  feedSizeMm?: MaybeNumber;
};

export type FeedInventoryLike = {
  openingStockKg?: MaybeNumber;
  openingStockBrand?: string;
  openingStockSizeMm?: MaybeNumber;
  purchases?: FeedPurchaseLike[];
};

export type FeedProductSummary = {
  key: string;
  brand: string;
  pelletSizeMm: number | null;
  label: string;
  purchasedKg: number;
  purchasedCost: number;
  consumedKg: number;
  remainingKg: number;
  avgDailyUse: number;
  estimatedDaysLeft: number | null;
  feedingDays14: number;
  bagSizesKg: number[];
  purchaseCount: number;
  lastUsedAt: string | null;
  lowStockSeverity: "warning" | "critical" | null;
};

function toFiniteNumber(value: MaybeNumber) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function normalizePelletSize(value: MaybeNumber): number | null {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

export function parseFeedTypeLabel(value: string | undefined | null): FeedIdentity {
  const label = normalizeText(value);
  if (!label) return { brand: "", pelletSizeMm: null };

  const match = label.match(/^(.*?)(?:\s+|\b)(\d+(?:\.\d+)?)\s*mm$/i);
  if (!match) return { brand: label, pelletSizeMm: null };

  const brand = normalizeText(match[1]);
  const pelletSizeMm = normalizePelletSize(match[2]);
  return { brand: brand || label, pelletSizeMm };
}

export function formatFeedLabel(brand: string, pelletSizeMm: number | null) {
  const cleanBrand = normalizeText(brand);
  if (!cleanBrand) return pelletSizeMm != null ? `${pelletSizeMm}mm feed` : "Unassigned feed";
  return pelletSizeMm != null ? `${cleanBrand} ${pelletSizeMm}mm` : cleanBrand;
}

export function getFeedIdentity(input: {
  brand?: string;
  pelletSizeMm?: MaybeNumber;
  feedType?: string;
}): FeedIdentity {
  const directBrand = normalizeText(input.brand);
  const directSize = normalizePelletSize(input.pelletSizeMm);
  if (directBrand || directSize != null) {
    return { brand: directBrand, pelletSizeMm: directSize };
  }
  return parseFeedTypeLabel(input.feedType);
}

export function getFeedKey(brand: string, pelletSizeMm: number | null) {
  const cleanBrand = normalizeText(brand).toLowerCase();
  return `${cleanBrand || "unassigned"}::${pelletSizeMm != null ? pelletSizeMm : "na"}`;
}

type MutableProduct = {
  key: string;
  brand: string;
  pelletSizeMm: number | null;
  label: string;
  purchasedKg: number;
  purchasedCost: number;
  consumedKg: number;
  avgDailyUse: number;
  feedingDays14: number;
  bagSizesKg: Set<number>;
  purchaseCount: number;
  lastUsedAt: string | null;
};

function ensureProduct(products: Map<string, MutableProduct>, identity: FeedIdentity) {
  const label = formatFeedLabel(identity.brand, identity.pelletSizeMm);
  const key = getFeedKey(identity.brand, identity.pelletSizeMm);
  const existing = products.get(key);
  if (existing) return existing;

  const created: MutableProduct = {
    key,
    brand: identity.brand,
    pelletSizeMm: identity.pelletSizeMm,
    label,
    purchasedKg: 0,
    purchasedCost: 0,
    consumedKg: 0,
    avgDailyUse: 0,
    feedingDays14: 0,
    bagSizesKg: new Set<number>(),
    purchaseCount: 0,
    lastUsedAt: null,
  };
  products.set(key, created);
  return created;
}

export function summarizeFeedInventory(inventory: FeedInventoryLike | null | undefined, logs: FeedLogLike[]) {
  const openingStockKg = toFiniteNumber(inventory?.openingStockKg);
  const openingIdentity = getFeedIdentity({
    brand: inventory?.openingStockBrand,
    pelletSizeMm: inventory?.openingStockSizeMm,
  });
  const products = new Map<string, MutableProduct>();

  if (openingStockKg > 0) {
    const product = ensureProduct(products, openingIdentity);
    product.purchasedKg += openingStockKg;
  }

  for (const purchase of inventory?.purchases || []) {
    const identity = getFeedIdentity({
      brand: purchase.brand,
      pelletSizeMm: purchase.pelletSizeMm,
      feedType: purchase.brand,
    });
    const product = ensureProduct(products, identity);
    product.purchasedKg += toFiniteNumber(purchase.totalKg);
    product.purchasedCost += toFiniteNumber(purchase.totalCost);
    product.purchaseCount += 1;
    const bagSizeKg = toFiniteNumber(purchase.bagSizeKg);
    if (bagSizeKg > 0) product.bagSizesKg.add(bagSizeKg);
  }

  const last14 = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).getTime();
  const fourteenDayUsage = new Map<string, { consumedKg: number; feedingDates: Set<string> }>();
  let consumedKg = 0;

  for (const log of logs || []) {
    const feedGiven = toFiniteNumber(log.feedGiven);
    consumedKg += feedGiven;
    if (feedGiven <= 0) continue;

    const identity = getFeedIdentity({
      brand: log.feedBrand,
      pelletSizeMm: log.feedSizeMm,
      feedType: log.feedType,
    });
    const product = ensureProduct(products, identity);
    product.consumedKg += feedGiven;

    const logDate = log.date ? new Date(log.date) : null;
    const isoDate = logDate && !Number.isNaN(logDate.getTime()) ? logDate.toISOString() : null;
    if (isoDate && (!product.lastUsedAt || isoDate > product.lastUsedAt)) {
      product.lastUsedAt = isoDate;
    }
    if (!logDate || Number.isNaN(logDate.getTime()) || logDate.getTime() < last14) continue;

    const tracker = fourteenDayUsage.get(product.key) || { consumedKg: 0, feedingDates: new Set<string>() };
    tracker.consumedKg += feedGiven;
    tracker.feedingDates.add(logDate.toISOString().slice(0, 10));
    fourteenDayUsage.set(product.key, tracker);
  }

  const purchasedKg = (inventory?.purchases || []).reduce((sum, purchase) => sum + toFiniteNumber(purchase.totalKg), 0);
  const purchasedCost = (inventory?.purchases || []).reduce((sum, purchase) => sum + toFiniteNumber(purchase.totalCost), 0);
  const stockedKg = openingStockKg + purchasedKg;
  const remainingKg = Math.max(0, openingStockKg + purchasedKg - consumedKg);

  const productSummaries: FeedProductSummary[] = Array.from(products.values())
    .map((product) => {
      const usage14 = fourteenDayUsage.get(product.key);
      const feedingDays14 = usage14?.feedingDates.size || 0;
      const avgDailyUse = feedingDays14 > 0 ? usage14!.consumedKg / feedingDays14 : 0;
      const itemRemainingKg = Math.max(0, product.purchasedKg - product.consumedKg);
      const estimatedDaysLeft = avgDailyUse > 0 ? itemRemainingKg / avgDailyUse : null;
      const lowStockSeverity: "warning" | "critical" | null =
        estimatedDaysLeft == null || itemRemainingKg <= 0
          ? null
          : estimatedDaysLeft <= 3
            ? "critical"
            : estimatedDaysLeft <= 7
              ? "warning"
              : null;

      return {
        key: product.key,
        brand: product.brand,
        pelletSizeMm: product.pelletSizeMm,
        label: product.label,
        purchasedKg: product.purchasedKg,
        purchasedCost: product.purchasedCost,
        consumedKg: product.consumedKg,
        remainingKg: itemRemainingKg,
        avgDailyUse,
        estimatedDaysLeft,
        feedingDays14,
        bagSizesKg: Array.from(product.bagSizesKg).sort((a, b) => a - b),
        purchaseCount: product.purchaseCount,
        lastUsedAt: product.lastUsedAt,
        lowStockSeverity,
      };
    })
    .sort((a, b) => {
      const daysA = a.estimatedDaysLeft ?? Number.POSITIVE_INFINITY;
      const daysB = b.estimatedDaysLeft ?? Number.POSITIVE_INFINITY;
      if (daysA !== daysB) return daysA - daysB;
      if (b.remainingKg !== a.remainingKg) return b.remainingKg - a.remainingKg;
      return a.label.localeCompare(b.label);
    });

  const lowStockProducts = productSummaries.filter((product) => product.lowStockSeverity !== null);

  return {
    openingStockKg,
    stockedKg,
    purchasedKg,
    purchasedCost,
    consumedKg,
    remainingKg,
    openingStock: {
      brand: openingIdentity.brand,
      pelletSizeMm: openingIdentity.pelletSizeMm,
      label: formatFeedLabel(openingIdentity.brand, openingIdentity.pelletSizeMm),
    },
    products: productSummaries,
    lowStockProducts,
  };
}
