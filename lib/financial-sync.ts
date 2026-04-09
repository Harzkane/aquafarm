import { Financial } from "@/models/Financial";

type FeedPurchaseExpenseInput = {
  userId: string;
  purchaseId: string;
  date: Date;
  totalCost: number;
  brand: string;
  pelletSizeMm?: number | null;
  bagSizeKg: number;
  bags: number;
  supplier?: string;
};

function buildFeedPurchaseDescription(input: FeedPurchaseExpenseInput) {
  const feedLabel = `${input.brand}${input.pelletSizeMm != null ? ` ${input.pelletSizeMm}mm` : ""}`;
  const supplier = input.supplier?.trim() ? ` from ${input.supplier.trim()}` : "";
  return `${feedLabel} ${input.bagSizeKg}kg bags x ${input.bags}${supplier}`.trim();
}

export async function syncFeedPurchaseExpense(input: FeedPurchaseExpenseInput) {
  let fin = await Financial.findOne({ userId: input.userId });
  if (!fin) fin = await Financial.create({ userId: input.userId, expenses: [], revenue: [] });

  const existing = fin.expenses.find(
    (expense: any) => expense.source === "feed_purchase" && String(expense.sourceRef || "") === input.purchaseId,
  );

  const payload = {
    category: "feed",
    description: buildFeedPurchaseDescription(input),
    amount: Number(input.totalCost || 0),
    date: input.date,
    source: "feed_purchase",
    sourceRef: input.purchaseId,
    sourceLabel: "Synced from feed inventory",
  };

  if (existing) Object.assign(existing, payload);
  else fin.expenses.push(payload as any);

  fin.updatedAt = new Date();
  await fin.save();
  return fin;
}

export async function removeFeedPurchaseExpense(userId: string, purchaseId: string) {
  const fin = await Financial.findOne({ userId });
  if (!fin) return null;

  const existing = fin.expenses.find(
    (expense: any) => expense.source === "feed_purchase" && String(expense.sourceRef || "") === purchaseId,
  );
  if (!existing) return fin;

  existing.deleteOne();
  fin.updatedAt = new Date();
  await fin.save();
  return fin;
}
