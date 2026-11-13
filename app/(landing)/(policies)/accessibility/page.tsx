import type { Metadata } from "next";
import Link from "next/link";
import LongForm from "@/components/browse/LongForm";
import { COMPANY } from "@/lib/about";

export const metadata: Metadata = {
  title: "Accessibility",
  description: "How Artfinity works toward WCAG 2.1 AA, what we know still falls short, and how to tell us about a problem.",
};

// TODO(Thomas): confirm the "help you finish your order" offer.
// Keep this honest: say what we aim for and what we know is missing. Update the date when it changes.
export default function AccessibilityPage() {
  const email = COMPANY.supportEmail;
  return (
    <LongForm title="Accessibility" current="/accessibility" sub="We want the whole site to work for everyone." summary={[
      "We aim for WCAG 2.1 AA and test for it, but don’t fully meet it yet.",
      "Some artwork descriptions and Studio charts still fall short.",
      "Stuck at checkout? Email us and we’ll help you finish your order.",
    ]}>
      <section>
        <p className="!mt-0 !text-[14px] text-ink-2">Last updated: November 5, 2026</p>

        <div>
          <h2>What we aim for</h2>
          <p>
            We work toward the{" "}
            <a href="https://www.w3.org/TR/WCAG21/" target="_blank" rel="noopener noreferrer">Web Content Accessibility Guidelines (WCAG) 2.1, level AA</a>{" "}
            across the site: buying a print after scanning a code, artist pages, the help center, signing up, and the artist Studio.
            We don&apos;t claim the site fully meets it yet. It&apos;s a goal we test against and keep working on.
          </p>
        </div>

        <div>
          <h2>What we do</h2>
          <ul>
            <li>Run automated checks (axe-core) on the main pages at desktop and phone sizes, and fix serious problems before they ship.</li>
            <li>Check pages with a keyboard only, and keep focus visible and inside open menus and sheets.</li>
            <li>Keep text contrast at 4.5:1 or more, and give images, buttons and form fields names a screen reader can announce.</li>
            <li>Respect your device&apos;s &ldquo;reduce motion&rdquo; setting. The homepage animations also have a pause button.</li>
          </ul>
        </div>

        <div>
          <h2>Known limits</h2>
          <ul>
            <li>
              <strong>Artwork descriptions.</strong> Artists upload and describe their own work. Many paintings only have their title as a description,
              which doesn&apos;t say what the picture shows.
            </li>
            <li>
              <strong>Room previews and zoom.</strong> &ldquo;See it on a wall&rdquo; previews are visual. Print sizes are also written out in inches.
              The zoom view works with a keyboard (+, &minus;, arrow keys, Esc) but is built for touch first.
            </li>
            <li>
              <strong>Payment.</strong> Card payment happens on Stripe&apos;s checkout page, which Stripe builds and maintains.
            </li>
            <li>
              <strong>Charts in the Studio.</strong> Sales and scan charts show the key numbers as text, but not every point on the chart.
            </li>
            <li>
              <strong>Videos and downloads.</strong> Auto-made share videos have no narration or captions, and printable QR sheets are PDFs that aren&apos;t tagged for screen readers.
            </li>
          </ul>
        </div>

        <div>
          <h2>Tell us about a problem</h2>
          <p>
            If something on Artfinity is hard or impossible to use with your setup, email{" "}
            <a href={`mailto:${email}?subject=${encodeURIComponent("Accessibility problem")}`}>{email}</a>. Tell us the page, what you were trying to do,
            and the browser or assistive technology you use if you can. A person reads every message ({COMPANY.hours}).
          </p>
          <p>
            If you&apos;d like to buy a print and can&apos;t get through checkout, write to us and we&apos;ll help you finish your order. You can also use our{" "}
            <Link href="/contact">contact page</Link>.
          </p>
        </div>
      </section>
    </LongForm>
  );
}
