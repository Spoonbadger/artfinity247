// Client-safe names for the social sign-in providers. Server code with secrets lives in lib/oauth/providers.

export const PROVIDER_IDS = ["google", "apple", "facebook", "instagram", "mock"] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export const PROVIDER_LABEL: Record<ProviderId, string> = {
  google: "Google",
  apple: "Apple",
  facebook: "Facebook",
  instagram: "Instagram",
  mock: "Mock (dev)",
};

export function isProviderId(v: unknown): v is ProviderId {
  return typeof v === "string" && (PROVIDER_IDS as readonly string[]).includes(v);
}

/** Login-page error codes (?oauth_error=) and what to say. */
export const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  account_closed: "This account is closed — contact us to reopen.",
  account_suspended: "This account is paused. Contact us if you think that's a mistake.",
  cancelled: "Sign-in was cancelled. Try again, or use your email.",
  expired: "That sign-in took too long. Try again.",
  state_mismatch: "That sign-in link didn't match. Try again.",
  unavailable: "That sign-in option isn't available right now. Use your email instead.",
  provider_error: "We couldn't finish signing you in. Try again, or use your email.",
  email_in_use:
    "An Artfinity page already uses that email. Log in with your password, then connect this account from Studio → My page.",
  already_linked: "That account is already connected to a different Artfinity page.",
  not_logged_in: "Log in first, then connect the account.",
};
