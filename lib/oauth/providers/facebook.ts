// Facebook Login: authorization code (+ PKCE, which Facebook accepts for the manual flow) and the Graph API /me.
// Facebook doesn't say whether the email it returns was verified, so it is treated as UNVERIFIED: it prefills
// sign-up but never links to an existing Artfinity page (connect Facebook from Studio to link instead).
// Env: FACEBOOK_CLIENT_ID (App ID), FACEBOOK_CLIENT_SECRET (App secret); optional META_GRAPH_VERSION.
import { createHmac } from "crypto";
import { fetchJson, str, withQuery } from "./http";
import { ProviderError, type OAuthProvider } from "./types";

const V = () => process.env.META_GRAPH_VERSION || "v23.0";

export const facebook: OAuthProvider = {
  id: "facebook",
  pkce: true,
  enabled: () => !!(process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET),
  authorizationUrl: ({ state, challenge, redirectUri }) =>
    withQuery(`https://www.facebook.com/${V()}/dialog/oauth`, {
      client_id: process.env.FACEBOOK_CLIENT_ID!,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "public_profile,email",
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
    }),
  async exchange({ code, verifier, redirectUri }) {
    const q: Record<string, string> = {
      client_id: process.env.FACEBOOK_CLIENT_ID!,
      client_secret: process.env.FACEBOOK_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      code,
    };
    if (verifier) q.code_verifier = verifier;
    const tok = await fetchJson(withQuery(`https://graph.facebook.com/${V()}/oauth/access_token`, q));
    const accessToken = str(tok.access_token, 2000);
    if (!accessToken) throw new ProviderError("provider_bad_response", "No access token");
    const proof = createHmac("sha256", process.env.FACEBOOK_CLIENT_SECRET!).update(accessToken).digest("hex");
    const me = await fetchJson(
      withQuery(`https://graph.facebook.com/${V()}/me`, { fields: "id,name,email,picture.width(400).height(400)", access_token: accessToken, appsecret_proof: proof }),
    );
    const id = str(me.id, 100);
    if (!id) throw new ProviderError("provider_bad_response", "No id");
    return {
      providerAccountId: id,
      email: str(me.email, 254)?.toLowerCase() ?? null,
      emailVerified: false,
      name: str(me.name, 60),
      avatar: me.picture?.data?.is_silhouette ? null : str(me.picture?.data?.url, 1000),
    };
  },
};
