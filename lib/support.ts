import { PlanKey } from "@/lib/plans";

function normalizeWhatsAppNumber(input: string) {
  return String(input || "").replace(/\D/g, "");
}

export function getPriorityWhatsAppHref(plan: PlanKey, userName?: string) {
  if (plan === "free") return "";

  const number = normalizeWhatsAppNumber(
    process.env.NEXT_PUBLIC_WHATSAPP_PRIORITY_NUMBER || process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || ""
  );
  if (!number) return "";

  const defaultMessage =
    plan === "commercial"
      ? "Hello AquaFarm team, I need priority support for my Pro+ Commercial account."
      : "Hello AquaFarm team, I need priority support for my Pro Founder account.";

  const customMessage =
    plan === "commercial"
      ? process.env.NEXT_PUBLIC_WHATSAPP_PRIORITY_MESSAGE_COMMERCIAL
      : process.env.NEXT_PUBLIC_WHATSAPP_PRIORITY_MESSAGE_PRO;

  const namePrefix = userName ? `Name: ${userName}. ` : "";
  const message = encodeURIComponent(`${namePrefix}${customMessage || defaultMessage}`);
  return `https://wa.me/${number}?text=${message}`;
}
