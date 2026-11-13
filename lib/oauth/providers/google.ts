// Google (OpenID Connect): authorization code + PKCE + nonce; the ID token is verified against Google's JWKS.
// Env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
import { claimTrue, remoteKeys, verifyIdToken } from "../idToken";
import { postForm, str, withQuery } from "./http";
import { ProviderError, type OAuthProvider } from "./types";

export const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const JWKS = "https://www.googleapis.com/oauth2/v3/certs";

export const google: OAuthProvider = {
  id: "google",
  pkce: true,
  enabled: () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  authorizationUrl: ({ state, challenge, nonce, redirectUri }) =>
    withQuery("https://accounts.google.com/o/oauth2/v2/auth", {
      client_id: process.env.GOOGLE_CLIENT_ID!,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      nonce,
      code_challenge: challenge,
      code_challenge_method: "S256",
      prompt: "select_account",
    }),
  async exchange({ code, verifier, nonce, redirectUri }) {
    if (!verifier) throw new ProviderError("missing_verifier");
    const tok = await postForm("https://oauth2.googleapis.com/token", {
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      code,
      code_verifier: verifier,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    });
    const claims = await verifyIdToken(String(tok.id_token || ""), {
      keys: remoteKeys(JWKS),
      issuer: GOOGLE_ISSUERS,
      audience: process.env.GOOGLE_CLIENT_ID!,
      nonce,
    });
    const email = str(claims.email, 254)?.toLowerCase() ?? null;
    return {
      providerAccountId: String(claims.sub),
      email,
      emailVerified: !!email && claimTrue(claims.email_verified),
      name: str(claims.name, 60),
      avatar: str(claims.picture, 500),
    };
  },
};
