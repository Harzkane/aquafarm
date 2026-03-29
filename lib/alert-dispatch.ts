import { AlertDelivery } from "@/models/AlertDelivery";
import { AlertNotification } from "@/models/AlertNotification";
import { User } from "@/models/User";

type DispatchResult = {
  checked: number;
  sent: number;
  failed: number;
  skipped: number;
  cooldownSkipped: number;
  channelDisabled: number;
  sample: Array<{ alertId: string; userId: string; status: string; reason: string }>;
};

function normalizePhone(raw: string) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) return `234${digits.slice(1)}`;
  return digits;
}

function buildCriticalMessage(input: {
  title: string;
  message: string;
  farmName: string;
  href: string;
}) {
  const appUrl = String(process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/+$/, "");
  const url = input.href ? `${appUrl}${input.href}` : appUrl;
  return [
    "AquaFarm CRITICAL ALERT",
    `Farm: ${input.farmName || "Unknown farm"}`,
    input.title,
    input.message,
    url ? `Open: ${url}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function sendWhatsApp(to: string, text: string) {
  const provider = String(process.env.ALERT_WHATSAPP_PROVIDER || "webhook").toLowerCase();
  if (provider === "meta_cloud") {
    const accessToken = process.env.WHATSAPP_CLOUD_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID;
    if (!accessToken || !phoneNumberId) {
      return { ok: false as const, reason: "meta_cloud_not_configured" };
    }
    try {
      const res = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: text },
        }),
        cache: "no-store",
      });
      if (!res.ok) {
        return { ok: false as const, reason: `meta_http_${res.status}` };
      }
      const payload = await res.json().catch(() => ({}));
      const providerMessageId = String(payload?.messages?.[0]?.id || "");
      return { ok: true as const, providerMessageId };
    } catch {
      return { ok: false as const, reason: "meta_request_failed" };
    }
  }

  const webhookUrl = process.env.ALERT_WHATSAPP_WEBHOOK_URL;
  const webhookToken = process.env.ALERT_WHATSAPP_WEBHOOK_TOKEN;
  if (!webhookUrl) {
    return { ok: false as const, reason: "whatsapp_webhook_not_configured" };
  }

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(webhookToken ? { Authorization: `Bearer ${webhookToken}` } : {}),
      },
      body: JSON.stringify({ to, text }),
      cache: "no-store",
    });

    if (!res.ok) {
      return { ok: false as const, reason: `provider_http_${res.status}` };
    }
    const payload = await res.json().catch(() => ({}));
    return {
      ok: true as const,
      providerMessageId: String(payload?.id || payload?.messageId || ""),
    };
  } catch {
    return { ok: false as const, reason: "provider_request_failed" };
  }
}

export async function dispatchCriticalAlerts(limit: number, dryRun = false): Promise<DispatchResult> {
  const cooldownMinutes = Math.max(5, Number(process.env.ALERT_OUTBOUND_COOLDOWN_MINUTES || 360));
  const cooldownStart = new Date(Date.now() - cooldownMinutes * 60 * 1000);
  const defaultTo = normalizePhone(String(process.env.ALERTS_WHATSAPP_TO || ""));

  const alerts = await AlertNotification.find({ active: true, severity: "critical" })
    .where("status")
    .in(["new", "in_progress"])
    .sort({ updatedAt: -1 })
    .limit(limit)
    .select("_id userId title message href severity updatedAt assignedToName")
    .lean<any[]>();
  if (alerts.length === 0) {
    return {
      checked: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      cooldownSkipped: 0,
      channelDisabled: 0,
      sample: [],
    };
  }

  const userIds = Array.from(new Set(alerts.map((alert) => String(alert.userId))));
  const users = await User.find({ _id: { $in: userIds } })
    .select("_id farmName phone alertPrefs")
    .lean<any[]>();
  const userMap = new Map(users.map((user) => [String(user._id), user]));

  const alertIds = alerts.map((alert) => alert._id);
  const recentDeliveries = await AlertDelivery.find({
    alertId: { $in: alertIds },
    channel: "whatsapp",
    status: "sent",
    createdAt: { $gte: cooldownStart },
  })
    .select("alertId")
    .lean<any[]>();
  const cooldownAlertIds = new Set(recentDeliveries.map((item) => String(item.alertId)));

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let cooldownSkipped = 0;
  let channelDisabled = 0;
  const sample: Array<{ alertId: string; userId: string; status: string; reason: string }> = [];

  for (const alert of alerts) {
    const user = userMap.get(String(alert.userId));
    const prefs = user?.alertPrefs || {};
    const whatsappEnabled = prefs.whatsappCritical !== false;
    const to = normalizePhone(String(user?.phone || "")) || defaultTo;
    const alertId = String(alert._id);
    const userId = String(alert.userId);

    if (!whatsappEnabled) {
      channelDisabled += 1;
      skipped += 1;
      if (sample.length < 20) sample.push({ alertId, userId, status: "skipped", reason: "channel_disabled" });
      continue;
    }
    if (!to) {
      skipped += 1;
      if (sample.length < 20) sample.push({ alertId, userId, status: "skipped", reason: "missing_recipient" });
      continue;
    }
    if (cooldownAlertIds.has(alertId)) {
      cooldownSkipped += 1;
      skipped += 1;
      if (sample.length < 20) sample.push({ alertId, userId, status: "skipped", reason: "cooldown_active" });
      continue;
    }

    if (dryRun) {
      skipped += 1;
      if (sample.length < 20) sample.push({ alertId, userId, status: "skipped", reason: "dry_run" });
      continue;
    }

    const text = buildCriticalMessage({
      title: String(alert.title || "Critical alert"),
      message: String(alert.message || ""),
      farmName: String(user?.farmName || ""),
      href: String(alert.href || ""),
    });
    const sendResult = await sendWhatsApp(to, text);
    const status = sendResult.ok ? "sent" : "failed";
    if (sendResult.ok) sent += 1;
    else failed += 1;

    await AlertDelivery.create({
      userId: alert.userId,
      alertId: alert._id,
      channel: "whatsapp",
      status,
      reason: sendResult.ok ? "" : sendResult.reason,
      providerMessageId: sendResult.ok ? sendResult.providerMessageId || "" : "",
      alertVersion: new Date(alert.updatedAt).getTime(),
      payload: {
        to,
        title: alert.title,
        message: alert.message,
      },
    }).catch(() => {});

    if (sendResult.ok) {
      await AlertNotification.updateOne(
        { _id: alert._id },
        { $set: { lastDeliveredAt: new Date() } }
      ).catch(() => {});
    }

    if (sample.length < 20) {
      sample.push({
        alertId,
        userId,
        status,
        reason: sendResult.ok ? "sent" : sendResult.reason || "failed",
      });
    }
  }

  return {
    checked: alerts.length,
    sent,
    failed,
    skipped,
    cooldownSkipped,
    channelDisabled,
    sample,
  };
}
