// Social sign-in providers (server only). A provider is offered only when its env vars are set.
import type { ProviderId } from "../meta";
import { apple } from "./apple";
import { facebook } from "./facebook";
import { google } from "./google";
import { instagram } from "./instagram";
import { mock } from "./mock";
import type { OAuthProvider } from "./types";

export type { OAuthProfile, OAuthProvider } from "./types";
export { ProviderError } from "./types";

const ALL: Record<ProviderId, OAuthProvider> = { google, apple, facebook, instagram, mock };
/** Display order on the buttons. */
const ORDER: ProviderId[] = ["google", "apple", "facebook", "instagram", "mock"];

export function getProvider(id: string): OAuthProvider | null {
  const p = (ALL as Record<string, OAuthProvider | undefined>)[id];
  return p && p.enabled() ? p : null;
}

/** Ids of the providers that are configured right now, in button order. Safe to pass to client components. */
export function enabledProviders(): ProviderId[] {
  return ORDER.filter((id) => ALL[id].enabled());
}
