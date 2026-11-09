// Who may change things: the pure decision behind activeUserGuard() in lib/auth.ts (kept free of Next and Prisma
// so lib/accountGate.test.mjs can check it with plain `node --test`).
//
// A suspended (Artist.suspendedAt) or closed (Artist.closedAt) account can still sign in far enough to see Studio
// and read its own data, but anything that saves, sends, uploads or deletes answers 403 with one of these messages.
// The codes match the login page and lib/feedback.ts, which turns them into a "Contact us" button.

export type AccountState = "active" | "suspended" | "closed";
export type GateBody = { error: string; code: "not_logged_in" | "account_suspended" | "account_closed" };

export const NOT_SIGNED_IN = "Log in first.";
export const SUSPENDED_MESSAGE = "Your account is paused, so this can't be changed right now. Message us and we'll sort it out.";
export const CLOSED_MESSAGE = "This account is closed. Message us to reopen it.";

/** Closed wins over suspended: a closed account stays closed whatever else is set. */
export function accountState(row: { closedAt: Date | null; suspendedAt: Date | null }): AccountState {
  if (row.closedAt) return "closed";
  if (row.suspendedAt) return "suspended";
  return "active";
}

/** null = let it through. Otherwise the status and JSON body to answer with (401 not signed in, 403 paused/closed). */
export function gateResponse(state: AccountState | null, notSignedIn: string = NOT_SIGNED_IN): { status: 401 | 403; body: GateBody } | null {
  if (state === "active") return null;
  if (state === "suspended") return { status: 403, body: { error: SUSPENDED_MESSAGE, code: "account_suspended" } };
  if (state === "closed") return { status: 403, body: { error: CLOSED_MESSAGE, code: "account_closed" } };
  return { status: 401, body: { error: notSignedIn || NOT_SIGNED_IN, code: "not_logged_in" } };
}
