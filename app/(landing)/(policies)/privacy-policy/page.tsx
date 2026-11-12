import type { Metadata } from "next";
import Link from "next/link";
import LongForm from "@/components/browse/LongForm";

export const metadata: Metadata = { title: "Privacy policy" };

export default function Page() {
  return (
    <LongForm eyebrow="Policy" title="Privacy policy" current="/privacy-policy" summary={[
      "We collect what we need to sell, ship and pay artists: names, emails, addresses, uploads.",
      "Stripe handles card details. We never see your full card number.",
      "QR scans and page views are counted without names.",
      "We don’t sell your personal information.",
      "Email us to see, fix or delete your data.",
    ]}>
      <section>
        <p className="!mt-0 !text-[14px] text-ink-2">Last updated: November 5, 2026</p>

        <div>
          <h2>Introduction</h2>
          <p>This policy explains what Artfinity collects, why, and how we protect it. By using the site, you agree to it.</p>
        </div>

        <div>
          <h2>What we collect</h2>
          <ul>
            <li>Your name, email and shipping address when you buy, sign up or contact us. A phone number only if you file a copyright counter-notice, which the law requires.</li>
            <li>Payment details, which Stripe processes. We never see or store your full card number.</li>
            <li>For artists: your profile, the art you upload, and the Stripe account we pay you with. Stripe collects the bank and tax details for its payouts.</li>
            <li>When someone scans a QR code: the device type and a rough location (city, region, country), plus a random visitor id so artists can count unique scans. No names.</li>
            <li>When you view an artist&apos;s page: an anonymous view count with the device type and the site you came from (like Instagram), never the full link. We skip this if your browser sends Do Not Track or Global Privacy Control.</li>
            <li>
              If you open a free collector account (optional, never needed to buy): your email, when you last signed in, and the pieces you save to your wishlist. It shows only orders placed
              with the email you proved by opening our sign-in link. Delete it any time in your collection&apos;s settings: the account and wishlist go right away, and orders stay on record
              for accounting.
            </li>
            <li>Basic technical data such as IP address, browser and device.</li>
            <li>
              A few cookies and browser storage items (see our <Link href="/cookie-policy">cookie policy</Link>).
            </li>
          </ul>
        </div>

        <div>
          <h2>How we use it</h2>
          <ul>
            <li>To take payment, print and ship orders, and pay artists.</li>
            <li>To show artists their sales, scans and buyers (artists never get your card details).</li>
            <li>To answer support requests and review reports.</li>
            <li>To send order and account emails, and marketing only if you opted in.</li>
            <li>To keep the site working and secure, and to meet legal requirements.</li>
          </ul>
        </div>

        <div>
          <h2>Who we share it with</h2>
          <p>
            We don&apos;t sell your personal information. We share only what&apos;s needed with the services that run Artfinity: Stripe for payments, Cloudinary for image hosting, our
            print and shipping partners to deliver your order, and our email provider. They must keep it safe.
          </p>
        </div>

        <div>
          <h2>Your choices</h2>
          <p>
            Ask to see, fix or delete your data at <a href="mailto:support@theartfinity.com">support@theartfinity.com</a>. Unsubscribe from marketing emails with the link in each
            one. Artists can close their account at any time: the page goes offline right away, and remaining data is removed after any unpaid earnings are paid out.
          </p>
        </div>

        <div>
          <h2>Security</h2>
          <p>We take reasonable steps to protect your information, but no website or storage is completely secure.</p>
        </div>

        <div>
          <h2>Governing law</h2>
          <p>This policy is governed by the laws of the United States and the State of New York.</p>
        </div>

        <div>
          <h2>Changes</h2>
          <p>We may update this policy. Changes are posted here with a new date at the top.</p>
        </div>
      </section>
    </LongForm>
  );
}
