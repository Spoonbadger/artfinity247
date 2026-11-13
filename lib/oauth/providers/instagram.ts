// Instagram, through "Instagram API with Instagram Login" (the Basic Display API was retired on Dec 4, 2024).
// Limits: it only works for Instagram PROFESSIONAL accounts (Business or Creator; switching is free in the app),
// it never returns an email (sign-up asks for one), and the app needs Meta App Review for
// instagram_business_basic before anyone outside the app's own testers can use it. See AUTH_SETUP.md.
// What we get: the app-scoped account id, @username, display name and a profile picture.
// Env: INSTAGRAM_CLIENT_ID (Instagram app ID), INSTAGRAM_CLIENT_SECRET (Instagram app secret).
import { fetchJson, postForm, str, withQuery } from "./http";
import { ProviderError, type OAuthProvider } from "./types";

const V = () => process.env.META_GRAPH_VERSION || "v23.0";
export const IG_USERNAME_RE = /^[a-z0-9._]{1,30}$/;

export const instagram: OAuthProvider = {
  id: "instagram",
  pkce: false,
  enabled: () => !!(process.env.INSTAGRAM_CLIENT_ID && process.env.INSTAGRAM_CLIENT_SECRET),
  authorizationUrl: ({ state, redirectUri }) =>
    withQuery("https://www.instagram.com/oauth/authorize", {
      client_id: process.env.INSTAGRAM_CLIENT_ID!,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "instagram_business_basic",
      state,
      enable_fb_login: "0",
    }),
  async exchange({ code, redirectUri }) {
    const raw = await postForm("https://api.instagram.com/oauth/access_token", {
      client_id: process.env.INSTAGRAM_CLIENT_ID!,
      client_secret: process.env.INSTAGRAM_CLIENT_SECRET!,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code,
    });
    // Older responses are flat; newer ones wrap it in data[0].
    const tok = Array.isArray(raw?.data) ? raw.data[0] : raw;
    const accessToken = str(tok?.access_token, 2000);
    if (!accessToken) throw new ProviderError("provider_bad_response", "No access token");
    const me = await fetchJson(
      withQuery(`https://graph.instagram.com/${V()}/me`, { fields: "id,user_id,username,name,profile_picture_url", access_token: accessToken }),
    );
    // Graph API ids are strings (they don't fit in a JS number).
    const id = str(me.id, 100) || str(me.user_id, 100);
    if (!id) throw new ProviderError("provider_bad_response", "No id");
    const username = str(me.username, 30)?.toLowerCase() ?? null;
    return {
      providerAccountId: id,
      email: null,
      emailVerified: false,
      name: str(me.name, 60) || username,
      avatar: str(me.profile_picture_url, 1000),
      instagram: username && IG_USERNAME_RE.test(username) ? username : null,
    };
  },
};
