import type { Metadata } from "next";
import Link from "next/link";
import LongForm from "@/components/browse/LongForm";

export const metadata: Metadata = { title: "Privacy policy" };

export default function Page() {
  return (
    <LongForm title="Privacy policy" current="/privacy-policy" summary={[
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
            <li>
              If you sign up or log in as an artist with Google, Apple, Facebook or Instagram: the account id that service gives us, your email (Instagram doesn&apos;t share
              one), your name to fill in the sign-up form, and your profile photo, which we copy to use as your Artfinity photo (Apple doesn&apos;t share one). From Instagram
              we also get your @username, which we add to your links and use to verify you. We never get your password for those services, and we don&apos;t keep their
              access keys.
            </li>
            <li>
              For artists, in Account details: your legal name and state, for payouts and tax. We send your legal name and email to Stripe when you set up payouts. Your
              state also places you in the right city on Artfinity, so it shows next to your city on your art pages.
            </li>
            <li>
              If you import art from Google Drive or Dropbox: only the files and folders you pick. Google gives us a short-lived key that opens just those files. We use it to
              copy them and never store it. Dropbox gives us a temporary link to each file you choose.
            </li>
            <li>If you ask to be verified: the links you send us, your note, and a photo of you with your work or your studio. We visit your website to check that it&apos;s yours.</li>
            <li>When someone scans a QR code: the device type and a rough location (city, region, country), plus a random visitor id so artists can count unique scans. No names.</li>
            <li>When you view an artist&apos;s page: an anonymous view count with the device type and the site you came from (like Instagram), never the full link. We skip this if your browser sends Do Not Track or Global Privacy Control.</li>
            <li>If you follow an artist: your email, and your name if you give it. That artist can see and download it to send you their newsletter.</li>
            <li>
              If you open a free collector account (optional, never needed to buy): your email, when you last signed in, and the pieces you save to your wishlist. It shows only orders placed
              with the email you confirmed by opening our sign-in link. Delete it any time in your collection&apos;s settings: the account and wishlist go right away, and orders stay on record
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
            <li>To check uploads for explicit content and for copies of art already on Artfinity, and to verify artists.</li>
            <li>To feature artists&apos; work on Artfinity&apos;s Instagram, credited to them. Artists can turn this off in Share kit.</li>
            <li>To send order and account emails, and marketing only if you opted in.</li>
            <li>To keep the site working and secure, and to meet legal requirements.</li>
          </ul>
        </div>

        <div>
          <h2>Who we share it with</h2>
          <p>We don&apos;t sell your personal information. We share only what&apos;s needed with the services that run Artfinity, and we require them to keep it safe:</p>
          <ul>
            <li>Stripe, for payments, sales tax, artist payouts and Infinity billing.</li>
            <li>Vercel and Neon, which host the site and its database.</li>
            <li>Cloudinary, which stores and serves images.</li>
            <li>Resend, which sends our emails.</li>
            <li>Our print lab, which gets your name, shipping address and the files to print.</li>
            <li>A shipment-tracking service, which gets your parcel&apos;s tracking number to follow it.</li>
            <li>An error-reporting service, which gets error reports with names, emails and addresses removed.</li>
            <li>An image-checking service, which may check some uploaded images and verification photos.</li>
            <li>Google, Apple, Facebook or Instagram, if you sign in with them, and Google Drive or Dropbox, if you import from them.</li>
            <li>The artist you follow, who gets your email for their newsletter.</li>
          </ul>
        </div>

        <div>
          <h2>Your choices</h2>
          <p>
            Ask to see, fix or delete your data at <a href="mailto:support@theartfinity.com">support@theartfinity.com</a>. Unsubscribe from marketing emails with the link in each
            one. Artists can close their account at any time. Your Artist Page goes offline right away, and we remove remaining data once any unpaid earnings are paid out.
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
