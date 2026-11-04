// Shared Resend client. Without RESEND_API_KEY (local dev) emails are logged instead of sent,
// so every flow that sends mail still works on localhost.
import { Resend } from "resend";

type SendArgs = Parameters<Resend["emails"]["send"]>[0];

const key = process.env.RESEND_API_KEY;
const real = key ? new Resend(key) : null;

export const resend = {
  emails: {
    async send(args: SendArgs) {
      if (real) return real.emails.send(args);
      console.log(`[email:dev] to=${JSON.stringify((args as any).to)} subject="${(args as any).subject}"`);
      return { data: { id: "dev-email" }, error: null } as any;
    },
  },
};
export const emailEnabled = !!real;
