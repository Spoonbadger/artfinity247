/** @type {import('next').NextConfig} */
const nextConfig = {
  // photo scenes: the render route reads the photos and the catalog from disk, so ship them with it
  experimental: {
    outputFileTracingIncludes: { "/api/scenes/render": ["./scenes/photos/**/*", "./data/scenes.json"] },
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
  },
  // TDMRep (W3C): reserve text-and-data-mining rights on every page and image.
  async headers() {
    return [
      { source: "/:path*", headers: [{ key: "tdm-reservation", value: "1" }] },
      // Service worker (public/sw.js): always revalidate, so a VERSION bump reaches people quickly.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, max-age=0, must-revalidate" }] },
    ];
  },
  async rewrites() {
    return [
      // Artist pages live at theartfinity.com/@handle
      // Painting (buy page): theartfinity.com/@handle/art/<slug>. Old /art/<slug> links 308 here.
      { source: "/@:handle/art/:art", destination: "/artists/:handle/art/:art" },
      // Link-in-bio page: theartfinity.com/@handle/links
      { source: "/@:handle/links", destination: "/artists/:handle/links" },
      { source: "/@:handle/collections", destination: "/artists/:handle/collections" },
      { source: "/@:handle/collections/:collection", destination: "/artists/:handle/collections/:collection" },
      { source: "/@:handle", destination: "/artists/:handle" },
    ];
  },
};

// Sentry (error alerts, DEPLOY.md → Sentry). Only wraps the config when a DSN is set, so local dev and a build
// with no Sentry env are exactly the config above. Source maps are uploaded only when SENTRY_AUTH_TOKEN is set too.
const sentryDsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

async function withSentry(config) {
  if (!sentryDsn) return config;
  const { withSentryConfig } = await import("@sentry/nextjs");
  const upload = !!process.env.SENTRY_AUTH_TOKEN;
  return withSentryConfig(
    // Next 14 needs the instrumentation hook for instrumentation.ts (Sentry's server and edge init).
    { ...config, experimental: { ...config.experimental, instrumentationHook: true } },
    {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: !process.env.CI,
      telemetry: false,
      sourcemaps: { disable: !upload, deleteSourcemapsAfterUpload: true },
      release: { create: upload },
      widenClientFileUpload: upload,
      bundleSizeOptimizations: { excludeDebugStatements: true },
    },
  );
}

export default await withSentry(nextConfig);
