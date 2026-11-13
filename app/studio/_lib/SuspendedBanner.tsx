// Shown at the top of every Studio page while an admin has the account suspended.
const CONTACT = process.env.CONTACT_EMAIL || "contact@theartfinity.com";

export default function SuspendedBanner({ since, reason }: { since: Date; reason: string | null }) {
  const day = since.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  return (
    <div className="mx-auto max-w-[1320px] px-4 pt-6 sm:px-6 lg:px-10 lg:pt-9">
    <div role="alert" className="grid gap-1.5 rounded-[4px] border-2 border-coral bg-[#fff1ed] px-4 py-3 text-[14.5px] leading-relaxed">
      <b className="text-[15.5px]">Your page is paused</b>
      <p>
        Since {day}, your artist page, artwork pages and printed codes are offline and buyers can&apos;t check out.
        Your sales and earnings are safe: anything you&apos;ve earned is still paid out on schedule.
      </p>
      {reason && <p><span className="font-semibold">Reason:</span> {reason}</p>}
      <p>
        Questions, or think this is a mistake? Email{" "}
        <a href={`mailto:${CONTACT}?subject=${encodeURIComponent("My Artfinity page is paused")}`} className="font-semibold text-scan underline">{CONTACT}</a>{" "}
        or use the <a href="/contact" className="font-semibold text-scan underline">contact form</a>.
      </p>
    </div>
    </div>
  );
}
