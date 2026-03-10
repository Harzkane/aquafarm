import { connectDB } from "@/lib/db";
import { CronRun } from "@/models/CronRun";

type CronStatus = "success" | "failed";

type LogCronRunInput = {
  job: string;
  status: CronStatus;
  dryRun?: boolean;
  durationMs?: number;
  metrics?: Record<string, unknown>;
  error?: string;
};

function truncate(value: string, max = 600) {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 3)}...`;
}

export async function logCronRun(input: LogCronRunInput) {
  try {
    await connectDB();
    await CronRun.create({
      job: input.job,
      status: input.status,
      dryRun: Boolean(input.dryRun),
      durationMs: Math.max(0, Math.trunc(Number(input.durationMs || 0))),
      metrics: input.metrics || {},
      error: truncate(String(input.error || ""), 600),
    });
  } catch {
    // Do not break cron processing if observability write fails.
  }
}

