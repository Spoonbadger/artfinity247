import type { ProviderId } from "../meta";

/** What we keep from a provider after a successful sign-in. */
export type OAuthProfile = {
  providerAccountId: string;
  email: string | null;
  /** Only true when the provider itself says the email is verified. Linking to an existing page needs this. */
  emailVerified: boolean;
  name: string | null;
  avatar: string | null;
  /** Instagram username (Instagram only). */
  instagram?: string | null;
};

export type AuthorizeInput = { state: string; challenge: string; nonce: string; redirectUri: string };
export type ExchangeInput = {
  code: string;
  verifier: string | null;
  nonce: string;
  redirectUri: string;
  /** Apple's form_post body (holds the one-time `user` JSON with name and email). */
  form: URLSearchParams | null;
};

export type OAuthProvider = {
  id: ProviderId;
  /** True when every env var it needs is set. Buttons only show for enabled providers. */
  enabled(): boolean;
  /** Sends a PKCE challenge (the verifier is kept in the flow cookie). */
  pkce: boolean;
  authorizationUrl(i: AuthorizeInput): string;
  exchange(i: ExchangeInput): Promise<OAuthProfile>;
};

export class ProviderError extends Error {
  constructor(public code: string, message?: string) {
    super(message || code);
  }
}
