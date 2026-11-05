// Runs a background job and keeps a JobRun row for it (start, finish, ok, summary, details). Server only.
//
//   const r = await runJob("stuck-orders", async () => ({ summary: "3 alerts raised", details: {...} }))
//
// - Never throws: an error becomes ok=false on the run and a "job_failed" alert for an admin (resolved on the next
//   good run of that job).
// - One run of a job at a time: a transaction-scoped Postgres advisory lock serializes the "is one running?" check and
//   the insert, so two cron calls (or a cron and a "Run now") can't both start. A run that never finished (the
//   function was killed) stops blocking after STALE_MS.
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { alertKey, raiseAlert, resolveAlert } from "@/lib/alerts";
import { reportError } from "@/lib/monitor";

export type JobSource = "cron" | "manual";
export type JobContext = { now: Date; source: JobSource; by?: string | null };
export type JobResult = { summary: string; details?: Record<string, unknown>; ok?: boolean };
export type RunOutcome =
  | { status: "ok" | "failed"; runId: string; summary: string; details?: Record<string, unknown> }
  | { status: "skipped"; reason: string };

/** A run older than this with no finish time is treated as dead (Vercel kills functions long before). */
const STALE_MS = 15 * 60_000;

const json = (v: unknown) => JSON.parse(JSON.stringify(v ?? null)) as Prisma.InputJsonValue;

async function claim(job: string, ctx: JobContext): Promise<string | null> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`jobrun:${job}`}))`;
    const running = await tx.jobRun.findFirst({
      where: { job, finishedAt: null, startedAt: { gt: new Date(Date.now() - STALE_MS) } },
      select: { id: true },
    });
    if (running) return null;
    const row = await tx.jobRun.create({
      data: { job, startedAt: new Date(), summary: "Running…", details: json({ source: ctx.source, by: ctx.by ?? null }) },
      select: { id: true },
    });
    return row.id;
  });
}

export async function runJob(job: string, fn: (ctx: JobContext) => Promise<JobResult>, opts: Partial<JobContext> = {}): Promise<RunOutcome> {
  const ctx: JobContext = { now: opts.now ?? new Date(), source: opts.source ?? "cron", by: opts.by ?? null };
  let runId: string | null;
  try {
    runId = await claim(job, ctx);
  } catch (err) {
    console.error(`[job:${job}] couldn't start`, err);
    await reportError(err, { area: "job", name: job, extra: { stage: "claim" } });
    return { status: "skipped", reason: "Couldn't record the run (database error)." };
  }
  if (!runId) return { status: "skipped", reason: "Already running." };

  const started = Date.now();
  try {
    const r = await fn(ctx);
    const ok = r.ok !== false;
    await prisma.jobRun.update({
      where: { id: runId },
      data: { finishedAt: new Date(), ok, summary: r.summary.slice(0, 500), details: json({ source: ctx.source, by: ctx.by ?? null, ms: Date.now() - started, ...r.details }) },
    });
    console.log(`[job:${job}] ${ok ? "ok" : "failed"}: ${r.summary}`);
    if (ok) await resolveAlert(alertKey.jobFailed(job));
    else {
      await raiseAlert({ kind: "job_failed", key: alertKey.jobFailed(job), title: `Job "${job}" failed: ${r.summary}`.slice(0, 200), link: "/admin/jobs", severity: "urgent" });
      await reportError(new Error(`Job "${job}" failed: ${r.summary}`), { area: "job", name: job, extra: { runId, source: ctx.source } });
    }
    return { status: ok ? "ok" : "failed", runId, summary: r.summary, details: r.details };
  } catch (err) {
    const message = ((err as Error)?.message || String(err)).replace(/\s+/g, " ").slice(0, 400);
    console.error(`[job:${job}] failed`, err);
    await prisma.jobRun
      .update({ where: { id: runId }, data: { finishedAt: new Date(), ok: false, summary: `Error: ${message}`, details: json({ source: ctx.source, by: ctx.by ?? null, ms: Date.now() - started, error: message }) } })
      .catch((e) => console.error(`[job:${job}] couldn't record failure`, e));
    await raiseAlert({ kind: "job_failed", key: alertKey.jobFailed(job), title: `Job "${job}" failed: ${message}`.slice(0, 200), link: "/admin/jobs", severity: "urgent" });
    await reportError(err, { area: "job", name: job, extra: { runId, source: ctx.source } });
    return { status: "failed", runId, summary: `Error: ${message}` };
  }
}
