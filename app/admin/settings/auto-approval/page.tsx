import type { Metadata } from "next";
import Link from "next/link";
import { adminRoleOrRedirect } from "../../_components/gate";
import { PageHead, Pill } from "../../_components/ui";
import { activeProvider, configuredProvider, extraProvider, imageCheckReady, photoProvider, providerCoverage, providerProblem, SIGHTENGINE_FREE_OPS } from "@/lib/moderation";
import { trustSettings } from "@/lib/trust/settings";
import { instagramSignInAvailable } from "@/lib/trust/instagram";
import { sightengineOpsThisMonth } from "@/lib/trust/usage";
import { AUTO_APPROVE_AFTER } from "@/lib/trust/artwork";
import TrustForm from "./TrustForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Auto-approval" };

const COVER: Record<string, string> = { nudity: "nudity", gore: "gore", hate: "hate symbols", ai: "AI-made", faces: "faces", web: "copies online" };
const NAME: Record<string, string> = { sightengine: "Sightengine", google: "Google Vision", aws: "AWS Rekognition", local: "Local (NSFWJS)", mock: "Mock (dev only)", none: "None" };
const list = (xs: string[]) => xs.map((x) => COVER[x] ?? x).join(", ");

/** Owner settings: what goes live, and who gets verified, without a person. */
export default async function AutoApprovalPage() {
  await adminRoleOrRedirect("/admin/settings/auto-approval", "settings");
  const [s, ops] = await Promise.all([trustSettings(), sightengineOpsThisMonth()]);
  const main = activeProvider();
  const wanted = configuredProvider();
  const problem = main !== "none" ? providerProblem(main) : null;
  const extra = extraProvider();
  const photo = photoProvider();
  const mainCover = imageCheckReady() ? providerCoverage(main, "artwork") : [];
  const extraCover = extra !== "none" ? providerCoverage(extra, "extra") : [];
  const newCovered = ["gore", "hate"].every((c) => [...mainCover, ...extraCover].includes(c as never));
  const photoCover = providerCoverage(photo, "verification");
  const usesSightengine = main === "sightengine" || extra === "sightengine";

  const rows: { label: string; ok: boolean; value: string }[] = [
    {
      label: "Image check",
      ok: imageCheckReady(),
      value: imageCheckReady() ? `${NAME[main]}: ${list(mainCover)}` : wanted === "mock" ? "Mock is set, but it never runs in production" : problem ? `${NAME[main]}: ${problem}` : "None. Set IMAGE_MODERATION_PROVIDER",
    },
    {
      label: "New artists",
      ok: newCovered,
      value: newCovered ? (extra !== "none" ? `Plus ${NAME[extra]}: ${list(extraCover)}` : "Covered by the image check") : `Gore and hate symbols not checked. Their first ${AUTO_APPROVE_AFTER} pieces come to you. Set IMAGE_MODERATION_EXTRA=sightengine`,
    },
    {
      label: "Verification photo",
      ok: photoCover.includes("faces"),
      value: photoCover.includes("faces") ? `${NAME[photo]}: ${list(photoCover)}` : "Can't see faces. Requests come to you. Set IMAGE_MODERATION_EXTRA=sightengine",
    },
    { label: "Website", ok: true, value: "Looks for the artist's code or Artfinity link on their site" },
    { label: "Instagram", ok: instagramSignInAvailable(), value: instagramSignInAvailable() ? "Proved by Instagram sign-in with the same handle" : "Can't be checked yet. Instagram-only requests come to you" },
    { label: "Copies online", ok: false, value: "Not checked yet (follow-up: Google Vision web detection)" },
  ];

  return (
    <div className="grid max-w-[760px] gap-5">
      <PageHead level={2} title="Auto-approval" sub={<>Clean ones go through. Questionable ones come to you. Changes are logged in <Link href="/admin/activity" className="font-semibold text-scan">Activity</Link>.</>} />

      <TrustForm
        value={{ autoApprove: s.autoApprove, autoVerify: s.autoVerify, spotCheckEvery: s.spotCheckEvery, velocityN: s.velocityN, minAccountDays: s.minAccountDays }}
        providerReady={s.providerReady}
        verifyReady={s.verifyReady}
      />

      <section aria-labelledby="checks-h" className="af-panel grid gap-3 p-4 sm:p-5">
        <h2 id="checks-h" className="t-card">What runs</h2>
        <dl className="grid gap-2 text-[14px]">
          {rows.map((r) => (
            <div key={r.label} className="grid gap-1 sm:grid-cols-[150px_minmax(0,1fr)] sm:items-baseline">
              <dt className="font-semibold">{r.label}</dt>
              <dd className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-baseline gap-2">
                <Pill tone={r.ok ? "green" : "amber"}>{r.ok ? "On" : "Off"}</Pill>
                <span className="min-w-0 text-ink-2">{r.value}</span>
              </dd>
            </div>
          ))}
          {usesSightengine && (
            <div className="grid gap-1 sm:grid-cols-[150px_minmax(0,1fr)] sm:items-baseline">
              <dt className="font-semibold">Sightengine</dt>
              <dd className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-baseline gap-2">
                <Pill tone={ops >= SIGHTENGINE_FREE_OPS ? "red" : ops >= SIGHTENGINE_FREE_OPS * 0.8 ? "amber" : "green"}>
                  <span className="num">{ops.toLocaleString("en-US")}</span>
                </Pill>
                <span className="text-ink-2">of {SIGHTENGINE_FREE_OPS.toLocaleString("en-US")} free operations this month</span>
              </dd>
            </div>
          )}
        </dl>
        <details className="t-small">
          <summary className="cursor-pointer font-semibold">How it decides</summary>
          <ul className="mt-1 grid list-disc gap-1 pl-5">
            <li>A piece goes live when the image check is clean, it isn&apos;t another artist&apos;s image, and the title has no slurs, links or contact details.</li>
            <li>The artist has no open report and isn&apos;t suspended. New artists past the daily upload limit wait.</li>
            <li>A check that can&apos;t run holds the piece. It never approves.</li>
            <li>An artist is verified when their site shows the code, a person is in the photo, and their record is clean.</li>
            <li>An upheld DMCA notice or a suspension removes the seal.</li>
          </ul>
        </details>
      </section>
    </div>
  );
}
