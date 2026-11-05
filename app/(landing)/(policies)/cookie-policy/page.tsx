import type { Metadata } from "next";
import LongForm from "@/components/browse/LongForm";

export const metadata: Metadata = { title: "Cookie policy" };

export default function Page() {
  return (
    <LongForm eyebrow="Policy" title="Cookie policy" current="/cookie-policy">
      <section>
        <p className="!mt-0 !text-[14px] text-ink-2">Last updated: November 4, 2026</p>

        <div>
          <h2>What cookies are</h2>
          <p>Cookies are small text files a website stores in your browser. Sites also keep small notes in browser storage. We use both, sparingly.</p>
        </div>

        <div>
          <h2>What we use</h2>
          <ul>
            <li>
              <strong>Login</strong> (auth-token): keeps you signed in.
            </li>
            <li>
              <strong>QR scans</strong> (af_vid, af_qc): a random visitor id so artists can count unique scans, and the last code you scanned so its discount and credit carry
              over to the artist&apos;s other pieces.
            </li>
            <li>
              <strong>Your cart and settings</strong> (browser storage): your cart, artists you follow, your choice on sensitive images, and that you&apos;ve seen this notice.
            </li>
          </ul>
          <p>We don&apos;t use advertising cookies or third-party tracking cookies. Stripe sets its own cookies on its checkout page to process payment safely.</p>
        </div>

        <div>
          <h2>Managing cookies</h2>
          <p>You can block or clear cookies in your browser settings:</p>
          <ul>
            <li>
              <a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer">Chrome</a>
            </li>
            <li>
              <a href="https://support.apple.com/guide/safari/sfri11471/mac" target="_blank" rel="noopener noreferrer">Safari</a>
            </li>
            <li>
              <a href="https://support.mozilla.org/en-US/kb/clear-cookies-and-site-data-firefox" target="_blank" rel="noopener noreferrer">Firefox</a>
            </li>
          </ul>
          <p>If you block them, logging in and your cart won&apos;t work.</p>
        </div>

        <div>
          <h2>Changes</h2>
          <p>We may update this policy. Changes are posted here with a new date at the top.</p>
        </div>
      </section>
    </LongForm>
  );
}
