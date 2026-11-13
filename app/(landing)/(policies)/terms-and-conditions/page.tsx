import type { Metadata } from "next";
import Link from "next/link";
import LongForm from "@/components/browse/LongForm";
import { PRINT_BUSINESS_DAYS, SHIP_BUSINESS_DAYS } from "@/lib/delivery";
import { HELP_DAYS_AFTER_DELIVERY } from "@/lib/reprintFormat";

const SUMMARY = [
  "You must be 18 or older to use the site or buy.",
  "Prints are made to order and ship free, to US addresses only.",
  `Damaged, misprinted or wrong? Tell us within ${HELP_DAYS_AFTER_DELIVERY} days of delivery and we reprint it free. No change-of-mind returns.`,
  "Buying a print doesn’t give you the copyright.",
  "Disputes go to binding arbitration in New York.",
];

export const metadata: Metadata = { title: "Terms and conditions" };

export default function Page() {
  return (
    <LongForm title="Terms and conditions" sub="Using the site and buying prints." current="/terms-and-conditions" summary={SUMMARY}>
      <section>
        <p className="!mt-0 !text-[14px] text-ink-2">Last updated: November 5, 2026</p>

        <div>
          <h2>Introduction</h2>
          <p>
            These terms cover your use of Artfinity (theartfinity.com) and any print you buy here. By using the site or placing an order, you agree to them.
            You must be 18 or older, or old enough to form a binding contract where you live.
          </p>
          <p>
            Artfinity prints, sells and ships the prints on this site. Each artwork belongs to the artist who made it. Artists who sell here also agree to the{" "}
            <Link href="/artist-terms-and-agreement">artist terms</Link>.
          </p>
        </div>

        <div>
          <h2>Using the site</h2>
          <p>
            Use the site for lawful purposes only. Text, images, logos and artwork on the site belong to Artfinity or to our artists. Don&apos;t copy, scrape or reuse them without permission.
          </p>
        </div>

        <div>
          <h2>Prices and payment</h2>
          <ul>
            <li>Prices are in US dollars. The artist sets the price of each print size; frames are priced by Artfinity.</li>
            <li>US shipping is free. Sales tax is added at checkout where the law requires it, and the total you see there is the price you pay.</li>
            <li>You pay the price shown when you place the order. A scan discount applies only when it comes from a valid printed code.</li>
            <li>Payments are handled by Stripe. We never see or store your full card number.</li>
          </ul>
        </div>

        <div>
          <h2>Shipping and delivery</h2>
          <ul>
            <li>We ship to US addresses only.</li>
            <li>
              Every print is made to order. Printing takes about {PRINT_BUSINESS_DAYS.min}–{PRINT_BUSINESS_DAYS.max} business days and shipping about {SHIP_BUSINESS_DAYS.min}–
              {SHIP_BUSINESS_DAYS.max} business days. Delivery dates are estimates, and carriers can be late.
            </li>
            <li>Arrives damaged, misprinted or wrong? We reprint it free. See below.</li>
          </ul>
        </div>

        <div>
          <h2>Returns and refunds</h2>
          <p>
            Because prints are made to order, we don&apos;t take returns for a change of mind or a wrong size choice. If your print arrives damaged, misprinted or wrong, email{" "}
            <a href="mailto:support@theartfinity.com">support@theartfinity.com</a> within 14 days of delivery with your order number and a photo. We reprint and reship it free, or
            refund you if a reprint won&apos;t fix it. Full details are in our <Link href="/return-policy">return policy</Link>.
          </p>
        </div>

        <div>
          <h2>Artwork and copyright</h2>
          <p>
            Every artwork stays the property of its artist. Buying a print gives you the print, not the copyright: you may not copy, resell or reproduce the image.
          </p>
          <p>
            Think a piece on Artfinity copies someone else&apos;s work? <Link href="/report">Report it</Link>. Our moderation team reviews every report, and we take down work that infringes. Formal notices: see <Link href="/dmca">Copyright and DMCA</Link>.
          </p>
        </div>

        <div>
          <h2>Disclaimer and limitation of liability</h2>
          <p>
            We work to keep product information accurate, but we can&apos;t promise the site will always be error-free or available. To the fullest extent the law allows, Artfinity
            disclaims all warranties, express or implied. Our liability for any order is limited to what you paid for it, and we are not liable for indirect, incidental or
            consequential damages.
          </p>
        </div>

        <div>
          <h2>Governing law</h2>
          <p>These terms are governed by the laws of the United States and the State of New York, without regard to conflict of law rules.</p>
        </div>

        <div>
          <h2>Disputes</h2>
          <p>
            Any dispute under these terms will be settled by binding arbitration under the rules of the American Arbitration Association, in New York, New York. You give up any right
            to a jury trial or to join a class action.
          </p>
        </div>

        <div>
          <h2>Changes</h2>
          <p>We may update these terms. Changes take effect when posted here, and the date at the top will change. Using the site after that means you accept them.</p>
        </div>

        <div>
          <h2>Credits</h2>
          <p>
            City, town and ZIP code data in our location search comes from{" "}
            <a href="https://www.geonames.org/" target="_blank" rel="noopener">GeoNames</a>, used under the{" "}
            <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">Creative Commons Attribution 4.0 license</a>. Neighborhood names
            come from Code for America&rsquo;s{" "}
            <a href="https://github.com/codeforgermany/click_that_hood" target="_blank" rel="noopener">Click That &rsquo;Hood</a> project.
          </p>
        </div>
      </section>
    </LongForm>
  );
}
