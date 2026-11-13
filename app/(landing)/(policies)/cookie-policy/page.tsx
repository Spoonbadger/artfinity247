import type { Metadata } from "next";
import LongForm from "@/components/browse/LongForm";

export const metadata: Metadata = { title: "Cookie policy" };

export default function Page() {
  return (
    <LongForm title="Cookie policy" current="/cookie-policy" summary={[
      "A few cookies keep you logged in, protect sign-ups and count QR scans.",
      "Your cart and settings live in your browser.",
      "No advertising or third-party tracking cookies.",
    ]}>
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
              <strong>Login</strong> (auth-token for artists, collector-token for collectors): keeps you signed in. Artists stay signed in for 30 days if they tick &ldquo;Keep me
              logged in&rdquo; or use Google, Apple, Facebook or Instagram, and otherwise until the browser closes. Collectors stay signed in for 90 days.
            </li>
            <li>
              <strong>Social sign-in</strong> (af_oauth, af_oauth_signup): protect the trip to Google, Apple, Facebook or Instagram and back, and hold your name, email and photo
              while you finish signing up. They expire after 10 and 30 minutes.
            </li>
            <li>
              <strong>Security</strong> (af_dev): a random id for this browser, set when an artist signs up or logs in. We keep only a one-way fingerprint of it, to stop people
              from earning referral rewards by referring themselves. It lasts 2 years.
            </li>
            <li>
              <strong>QR scans and visits</strong> (af_vid, af_qc): a random visitor id so artists can count unique scans and visitors (1 year), and the last code you scanned so
              its discount and credit carry over to the artist&apos;s other pieces (7 days).
            </li>
            <li>
              <strong>Your cart and settings</strong> (browser storage): your cart, artists you follow, your choice on sensitive images, the print size you picked last, your sort
              choices, and that you&apos;ve seen this notice. In Studio, it also keeps drafts on your device, like your upload queue and a bulk order&apos;s ship-to address.
            </li>
            <li>
              <strong>Where your visit started</strong> (browser storage, this tab only): the site or QR code that brought you, so artists see where visits come from. It clears
              when you close the tab, and we skip it if your browser sends Do Not Track or Global Privacy Control.
            </li>
          </ul>
          <p>
            We don&apos;t use advertising cookies or third-party tracking cookies. Stripe sets its own cookies on its checkout page to process payment safely. Google, Apple,
            Facebook, Instagram and Dropbox may set their own cookies when you sign in with them or import files from them.
          </p>
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
          <p>If you block cookies, you can&apos;t log in. If you also block site data, your cart won&apos;t work.</p>
        </div>

        <div>
          <h2>Changes</h2>
          <p>We may update this policy. Changes are posted here with a new date at the top.</p>
        </div>
      </section>
    </LongForm>
  );
}
