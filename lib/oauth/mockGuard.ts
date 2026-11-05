// The dev-only "mock" sign-in provider (lib/oauth/providers/mock.ts) lets anyone sign in as anyone, so it must
// never run on a production build. This file has no imports so the unit check (lib/oauth/oauth.test.mjs) can load it.

type Env = Record<string, string | undefined>;

/** True only outside production AND when ALLOW_MOCK_OAUTH=1 (or ALLOW_TEST_CHECKOUT=1) is set on purpose. */
export function mockOAuthAllowed(env: Env = process.env): boolean {
  if (env.NODE_ENV === "production") return false;
  return env.ALLOW_MOCK_OAUTH === "1" || env.ALLOW_TEST_CHECKOUT === "1";
}
