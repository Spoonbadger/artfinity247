import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BrushStroke } from "@/components/af/Brush";
import { DabRow } from "@/components/browse/PageHead";
import Code from "@/components/devtools/Code";
import EmbedBuilder, { type Kind } from "@/components/devtools/EmbedBuilder";
import { getExamples } from "@/components/devtools/examples";
import { PROD_RATE_LIMIT, MAX_LIMIT, DEFAULT_LIMIT, PUBLIC_ARTWORK } from "@/components/devtools/publicApi";
import { SCRIPT_TAG, SITE, plainBuyLink } from "@/components/devtools/snippets";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Developers",
  description: "Embed Artfinity galleries, artwork cards and Buy a print buttons on any site. Free public read API.",
};

const EMBEDS: { kind: Kind; title: string; line: string; dab: string }[] = [
  { kind: "gallery", title: "Artist gallery", line: "Your newest pieces, live prices.", dab: "var(--af-scan)" },
  { kind: "card", title: "One artwork", line: "A single piece with its price and edition.", dab: "var(--af-coral)" },
  { kind: "buy", title: "Buy a print button", line: "Drop it under any photo of your work.", dab: "var(--af-sticker)" },
  { kind: "links", title: "Link in bio", line: "Points to your Artfinity links page.", dab: "var(--af-earned)" },
  { kind: "iframe", title: "Iframe card", line: "No script. For builders that block JavaScript.", dab: "var(--af-ink)" },
];

const SOON = [
  ["Webhooks", "Get a POST when a print sells."],
  ["API keys", "Arrive with webhooks."],
  ["Shopify, Squarespace, WordPress", "One-click plugins."],
  ["OAuth apps", "Act on behalf of an artist, with permission."],
];

function H2({ id, eyebrow, children, dabs }: { id: string; eyebrow: string; children: React.ReactNode; dabs?: string[] }) {
  return (
    <div id={id} className="mb-8 scroll-mt-24">
      <div className="mb-3 flex items-center gap-2.5"><DabRow colors={dabs} /><span className="eyebrow">{eyebrow}</span></div>
      <h2 className="display text-[40px] sm:text-[54px]">{children}</h2>
    </div>
  );
}

function Endpoint({ path, line, params, req, res }: { path: string; line: string; params?: [string, string][]; req: string; res: unknown }) {
  return (
    <article className="grid min-w-0 gap-4 border-t border-line pt-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-8">
      <div className="min-w-0">
        <h3 className="flex flex-wrap items-center gap-2 font-body text-[17px] font-bold [font-variation-settings:normal] [overflow-wrap:anywhere]">
          <span className="rounded-full bg-earned-soft px-2.5 py-0.5 text-[12px] font-bold text-earned">GET</span>
          <span className="num">{path}</span>
        </h3>
        <p className="mt-2 text-[15px] text-ink-2">{line}</p>
        {params && (
          <dl className="mt-4 grid gap-2 text-[14px]">
            {params.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[96px_1fr] gap-3 border-b border-dashed border-line pb-2">
                <dt className="num font-semibold text-scan">{k}</dt>
                <dd className="text-ink-2">{v}</dd>
              </div>
            ))}
          </dl>
        )}
        <Code className="mt-4" code={req} lang="shell" title="Request" />
      </div>
      <Code code={JSON.stringify(res, null, 2)} lang="json" title="Response · 200" maxHeight={420} />
    </article>
  );
}

export default async function DevelopersPage() {
  const ex = await getExamples();
  const artworks = ex
    ? await prisma.artwork.findMany({
        where: { ...PUBLIC_ARTWORK, artist: { slug: ex.handle } },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { slug: true, title: true, imageUrl: true, sensitive: true },
      })
    : [];
  const picks = artworks.map((a) => ({ ...a, slug: a.slug! }));
  const api = `${SITE}/api/public/v1`;

  return (
    <div className="overflow-x-clip">
      {/* HERO */}
      <section className="relative border-b border-line">
        <BrushStroke className="pointer-events-none absolute -right-20 top-16 hidden h-14 w-[380px] rotate-[-5deg] opacity-30 md:block" color="var(--af-scan)" />
        <div className="mx-auto grid max-w-[1240px] gap-8 px-4 pb-14 pt-10 sm:px-6 md:pt-14 lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-14 lg:pb-20">
          <div className="min-w-0">
            <div className="mb-4 flex items-center gap-2.5"><DabRow /><span className="eyebrow">Developers</span></div>
            <h1 className="display text-[54px] sm:text-[76px] lg:text-[88px]">
              Your art, on <span className="relative z-0 whitespace-nowrap">any site.<BrushStroke className="absolute -bottom-1 -left-2 -z-10 h-[0.42em] w-[calc(100%+16px)]" color="var(--af-sticker)" /></span>
            </h1>
            <p className="mt-5 max-w-[34ch] text-[19px] leading-snug text-ink-2">One script tag. Live prices. Checkout and shipping stay on us.</p>
            <div className="mt-7 flex flex-wrap gap-2.5">
              <Link href="/studio/developers" className="btn btn-blue">Get my snippets <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
              <a href="#api" className="btn btn-ghost">API reference</a>
            </div>
            <nav aria-label="On this page" className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-[14px] font-semibold text-ink-2">
              <a href="#embed" className="hover:text-ink">Embeds</a>
              <a href="#api" className="hover:text-ink">API</a>
              <a href="#limits" className="hover:text-ink">Limits and terms</a>
              <a href="#soon" className="hover:text-ink">Coming soon</a>
            </nav>
          </div>
          <div className="grid min-w-0 gap-3">
            <span className="text-[13px] font-semibold text-ink-2">1. Add the script once</span>
            <Code code={SCRIPT_TAG} lang="html" title="Before </body>" />
            <span className="mt-2 text-[13px] font-semibold text-ink-2">2. Put a div where the art goes</span>
            <Code code={`<div data-artfinity-artist="${ex?.handle ?? "yourhandle"}"></div>`} lang="html" title="Anywhere in the page" />
            <p className="text-[13px] text-ink-2">Shadow DOM inside, so your CSS can&apos;t break it. About 3 KB gzipped.</p>
          </div>
        </div>
      </section>

      {/* EMBEDS */}
      <section className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6 md:py-20">
        <H2 id="embed" eyebrow="Embeds">What you can embed</H2>
        {ex ? (
          <div className="grid gap-16">
            {EMBEDS.map((e) => (
              <div key={e.kind} className="grid min-w-0 gap-5">
                <div className="flex items-baseline gap-3">
                  <span className="paint-dab translate-y-0.5" style={{ ["--dab" as string]: e.dab }} aria-hidden="true" />
                  <h3 className="font-display text-[26px] font-extrabold [font-variation-settings:'wdth'_80]">{e.title}</h3>
                  <span className="hidden text-[15px] text-ink-2 sm:inline">{e.line}</span>
                </div>
                <EmbedBuilder handle={ex.handle} artworks={picks} kinds={[e.kind]} initialSlug={ex.artworkSlug} />
              </div>
            ))}

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="af-panel p-5">
                <h3 className="font-display text-[22px] font-extrabold [font-variation-settings:'wdth'_80]">Options</h3>
                <dl className="mt-3 grid gap-2 text-[14px]">
                  {[
                    ["data-layout", "grid, carousel or single"],
                    ["data-limit", `1 to ${MAX_LIMIT} pieces. Default 6.`],
                    ["data-theme", "light or dark"],
                  ].map(([k, v]) => (
                    <div key={k} className="grid grid-cols-[110px_1fr] gap-3 border-b border-dashed border-line pb-2">
                      <dt className="num font-semibold text-scan">{k}</dt>
                      <dd className="text-ink-2">{v}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 text-[13.5px] text-ink-2">Sensitive pieces stay blurred until the visitor taps Show.</p>
              </div>
              <div className="grid min-w-0 gap-3">
                <h3 className="font-display text-[22px] font-extrabold [font-variation-settings:'wdth'_80]">Email or no iframes?</h3>
                <p className="text-[14px] text-ink-2">A plain link always works.</p>
                <Code code={plainBuyLink(ex.artworkSlug, ex.artworkTitle)} lang="html" title="Plain link" />
                <p className="text-[13.5px] text-ink-2">oEmbed: <span className="num font-semibold text-ink [overflow-wrap:anywhere]">{SITE}/api/embed?url=</span> plus any artwork link.</p>
                <p className="text-[13.5px] text-ink-2">Single-page app? Call <span className="num font-semibold text-ink">window.Artfinity.scan()</span> after you add new divs.</p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-ink-2">Live previews appear once an artist has an approved piece.</p>
        )}
      </section>

      {/* API */}
      <section className="relative border-y border-line bg-wall">
        <div className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6 md:py-20">
          <H2 id="api" eyebrow="Public API v1" dabs={["var(--af-earned)", "var(--af-scan)", "var(--af-sticker)"]}>Read the art, as JSON</H2>
          <div className="mb-10 flex flex-wrap gap-x-8 gap-y-3 text-[14.5px]">
            <p><span className="text-ink-2">Base </span><b className="num [overflow-wrap:anywhere]">{api}</b></p>
            <p><span className="text-ink-2">Auth </span><b>none</b></p>
            <p><span className="text-ink-2">CORS </span><b>any origin</b></p>
            <p><span className="text-ink-2">Methods </span><b>GET</b></p>
          </div>
          {ex && (
            <div className="grid gap-10">
              <Endpoint
                path="/artists/:handle"
                line="Profile, city, medal, verified badge and links."
                req={`curl ${api}/artists/${ex.handle}`}
                res={ex.artistRes}
              />
              <Endpoint
                path="/artists/:handle/artworks"
                line="Approved pieces, newest first."
                params={[
                  ["limit", `1 to ${MAX_LIMIT}. Default ${DEFAULT_LIMIT}.`],
                  ["cursor", "nextCursor from the last page."],
                  ["collection", "A collection slug."],
                ]}
                req={`curl "${api}/artists/${ex.handle}/artworks?limit=1"`}
                res={ex.listRes}
              />
              <Endpoint
                path="/artworks/:slug"
                line="One piece: every size and price, edition info, buy link."
                req={`curl ${api}/artworks/${ex.artworkSlug}`}
                res={ex.artworkRes}
              />
              <Endpoint
                path="/artists/:handle/collections"
                line="The artist's series, with covers and counts."
                req={`curl ${api}/artists/${ex.handle}/collections`}
                res={ex.collectionsRes}
              />
              <article className="grid min-w-0 gap-4 border-t border-line pt-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-8">
                <div>
                  <h3 className="font-display text-[24px] font-extrabold [font-variation-settings:'wdth'_80]">Errors</h3>
                  <p className="mt-2 text-[15px] text-ink-2">Same shape every time.</p>
                  <dl className="mt-4 grid gap-2 text-[14px]">
                    {[
                      ["404", "not_found"],
                      ["400", "bad_request"],
                      ["405", "method_not_allowed"],
                      ["429", "rate_limited"],
                      ["500", "server_error"],
                    ].map(([k, v]) => (
                      <div key={k} className="grid grid-cols-[56px_1fr] gap-3 border-b border-dashed border-line pb-2">
                        <dt className="num font-semibold">{k}</dt>
                        <dd className="num text-ink-2">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <div className="grid min-w-0 gap-4">
                  <Code code={JSON.stringify({ error: { code: "not_found", message: "Artist not found." } }, null, 2)} lang="json" title="Response · 404" />
                  <Code
                    lang="js"
                    title="From the browser"
                    code={`const res = await fetch("${api}/artists/${ex.handle}/artworks?limit=6");\nconst { artworks, nextCursor } = await res.json();`}
                  />
                </div>
              </article>
            </div>
          )}
        </div>
      </section>

      {/* LIMITS + TERMS */}
      <section className="mx-auto grid max-w-[1240px] gap-10 px-4 py-16 sm:px-6 md:grid-cols-2 md:py-20">
        <div>
          <H2 id="limits" eyebrow="Limits" dabs={["var(--af-coral)", "var(--af-sticker)"]}>Rate limits</H2>
          <ul className="grid gap-3 text-[16px]">
            <li className="flex gap-3"><span className="paint-dab mt-1.5" style={{ ["--dab" as string]: "var(--af-scan)" }} aria-hidden="true" /><span><b className="num">{PROD_RATE_LIMIT}</b> requests a minute per IP. Then 429 with Retry-After.</span></li>
            <li className="flex gap-3"><span className="paint-dab mt-1.5" style={{ ["--dab" as string]: "var(--af-sticker)" }} aria-hidden="true" /><span>Responses are cached for <b className="num">60</b> seconds at the edge.</span></li>
            <li className="flex gap-3"><span className="paint-dab mt-1.5" style={{ ["--dab" as string]: "var(--af-earned)" }} aria-hidden="true" /><span>Embeds share the visitor&apos;s limit, not yours.</span></li>
          </ul>
        </div>
        <div>
          <H2 id="terms" eyebrow="Terms" dabs={["var(--af-ink)", "var(--af-scan)"]}>Fair use</H2>
          <ul className="grid gap-3 text-[16px]">
            <li className="flex gap-3"><span className="paint-dab mt-1.5" style={{ ["--dab" as string]: "var(--af-coral)" }} aria-hidden="true" /><span>Link every piece back to its Artfinity page.</span></li>
            <li className="flex gap-3"><span className="paint-dab mt-1.5" style={{ ["--dab" as string]: "var(--af-sticker)" }} aria-hidden="true" /><span>Credit the artist. Don&apos;t crop, recolor or resell the images.</span></li>
            <li className="flex gap-3"><span className="paint-dab mt-1.5" style={{ ["--dab" as string]: "var(--af-scan)" }} aria-hidden="true" /><span>Keep sensitive labels. Blur those pieces by default.</span></li>
            <li className="flex gap-3"><span className="paint-dab mt-1.5" style={{ ["--dab" as string]: "var(--af-ink)" }} aria-hidden="true" /><span>Prices change. Read them live, don&apos;t copy them.</span></li>
          </ul>
        </div>
      </section>

      {/* COMING SOON */}
      <section className="border-t border-line bg-ink text-white">
        <div className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6 md:py-20">
          <div id="soon" className="mb-8 scroll-mt-24">
            <span className="sticker-badge">Coming soon</span>
            <h2 className="display mt-4 text-[40px] text-white sm:text-[54px]">Next on the easel</h2>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SOON.map(([t, l], i) => (
              <li key={t} className="rounded-2xl border border-white/15 p-5">
                <span className="paint-dab" style={{ ["--dab" as string]: ["var(--af-sticker)", "var(--af-scan)", "var(--af-coral)", "var(--af-earned)"][i] }} aria-hidden="true" />
                <b className="mt-3 block text-[17px]">{t}</b>
                <span className="text-[14px] text-white/65">{l}</span>
              </li>
            ))}
          </ul>
          <p className="mt-10 text-[15px] text-white/70">
            Artist? <Link href="/studio/developers" className="font-semibold text-white underline-offset-2 hover:underline">Your snippets are ready in Studio <ArrowRight className="inline h-4 w-4" aria-hidden="true" /></Link>
          </p>
        </div>
      </section>
    </div>
  );
}
