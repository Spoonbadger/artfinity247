// Shared Resend client. Without RESEND_API_KEY (local dev) emails are logged instead of sent,
// so every flow that sends mail still works on localhost.
//
// Retries: a send that fails for a passing reason (rate limit, Resend 5xx, network error) is tried again twice, after
// 0.7 s and 2.5 s, with the same idempotency key so Resend never delivers it twice. Errors that won't fix themselves
// (bad address, validation) come back right away. There's no persistent outbox (that needs a table): a send that still
// fails after the retries is returned/thrown to the caller as before, and logged.
import { randomUUID } from "crypto";
import { Resend } from "resend";

type SendArgs = Parameters<Resend["emails"]["send"]>[0];
type SendOptions = Parameters<Resend["emails"]["send"]>[1];
type SendResult = Awaited<ReturnType<Resend["emails"]["send"]>>;

const key = process.env.RESEND_API_KEY;
const real = key ? new Resend(key) : null;

const RETRY_DELAYS_MS = [700, 2500];
const TRANSIENT = new Set(["rate_limit_exceeded", "application_error", "internal_server_error", "concurrent_idempotent_requests"]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const transient = (e: { name?: string; statusCode?: number | null }) => TRANSIENT.has(e.name || "") || e.statusCode === 429 || (e.statusCode ?? 0) >= 500;

async function sendWithRetry(client: Resend, args: SendArgs, opts?: SendOptions): Promise<SendResult> {
  const options = { ...opts, idempotencyKey: opts?.idempotencyKey ?? randomUUID() };
  for (let attempt = 0; ; attempt++) {
    const last = attempt >= RETRY_DELAYS_MS.length;
    let res: SendResult;
    try {
      res = await client.emails.send(args, options);
    } catch (err) {
      if (last) throw err;
      console.warn(`[email] send threw (try ${attempt + 1}), retrying`, (err as Error)?.message);
      await sleep(RETRY_DELAYS_MS[attempt]);
      continue;
    }
    if (!res.error) return res;
    if (last || !transient(res.error)) {
      console.error(`[email] send failed after ${attempt + 1} ${attempt ? "tries" : "try"}: ${res.error.name} ${res.error.message}`, JSON.stringify((args as { subject?: string }).subject ?? ""));
      return res;
    }
    console.warn(`[email] ${res.error.name} (try ${attempt + 1}), retrying`);
    await sleep(RETRY_DELAYS_MS[attempt]);
  }
}

export const resend = {
  emails: {
    async send(args: SendArgs, opts?: SendOptions) {
      if (real) return sendWithRetry(real, args, opts);
      console.log(`[email:dev] to=${JSON.stringify((args as any).to)} subject="${(args as any).subject}"`);
      return { data: { id: "dev-email" }, error: null } as any;
    },
  },
};
export const emailEnabled = !!real;
