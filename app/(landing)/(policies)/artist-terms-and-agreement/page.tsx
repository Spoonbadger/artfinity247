import type { Metadata } from "next";
import Link from "next/link";
import LongForm from "@/components/browse/LongForm";
import { FREE_SPLIT, PRO, pct, proPrice } from "@/lib/plans";
import { PAYOUT_DAY_OF_MONTH, RETURN_WINDOW_DAYS } from "@/lib/balance";

export const metadata: Metadata = { title: "Artist terms and agreement" };

const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;

export default function ArtistTermsPage() {
  return (
    <LongForm eyebrow="For artists" title="Artist terms and agreement" sub="Artfinity artist platform agreement" current="/artist-terms-and-agreement">
      <section>
        <p className="!mt-0 !text-[14px] text-ink-2">Last updated: November 4, 2026</p>

        <div>
          <h2>1. Eligibility</h2>
          <p>To sell on Artfinity, you must:</p>
          <ul>
            <li>Be at least 18 years old</li>
            <li>Live in the United States</li>
            <li>Have a Venmo account that can receive payments</li>
          </ul>
          <p>By signing up as an artist, you confirm this is true.</p>
        </div>

        <div>
          <h2>2. Your art, your copyright</h2>
          <p>You keep the copyright and all other rights in your art. Selling on Artfinity doesn&apos;t transfer them to us.</p>
          <p>When you upload a work, you give Artfinity a limited, non-exclusive license to:</p>
          <ul>
            <li>Print it and sell those prints to buyers</li>
            <li>Show it on Artfinity, including your artist page, QR codes and share images</li>
            <li>Promote it, and you, in Artfinity&apos;s marketing</li>
          </ul>
          <p>
            That&apos;s all the license covers. It lasts while the work is listed. When you remove a work or close your account, we stop offering it for sale, but we still
            finish orders already placed.
          </p>
        </div>

        <div>
          <h2>3. What you upload</h2>
          <p>When you upload a work, you confirm that:</p>
          <ul>
            <li>You made it, or you own or have licensed all the rights needed to sell prints of it</li>
            <li>It doesn&apos;t copy someone else&apos;s art, photos, characters or trademarks</li>
            <li>It contains nothing unlawful, defamatory or obscene</li>
          </ul>
          <p>Artfinity may remove any work, or suspend an account, that breaks these terms.</p>
        </div>

        <div>
          <h2>4. AI and scraping</h2>
          <ul>
            <li>Artfinity does not use your uploaded art to train AI models, and does not sell or license it to anyone who does.</li>
            <li>Our robots.txt asks AI crawlers not to collect art from the site. Crawlers that ignore it are outside our control, but we don&apos;t give them permission.</li>
          </ul>
        </div>

        <div>
          <h2>5. Reports and takedowns</h2>
          <p>
            Anyone who thinks a work on Artfinity infringes their rights can <Link href="/report">report it</Link>. A person at Artfinity reviews every report. Work that infringes is
            taken down, and we may ask you for proof that you hold the rights. Repeated infringement can close your account. Formal notices: see <Link href="/dmca">Copyright and DMCA</Link>.
          </p>
        </div>

        <div>
          <h2>6. Prices</h2>
          <ul>
            <li>You set the price of each print size. It can&apos;t be lower than Artfinity&apos;s base price for that size.</li>
            <li>Frames are priced by Artfinity and add the same amount for every artist.</li>
            <li>Buyers pay no shipping in the US. Shipping is covered by the print cost, not added to the buyer&apos;s total.</li>
            <li>A discount you print on a QR code comes off the price the buyer pays.</li>
          </ul>
        </div>

        <div>
          <h2>7. Your share</h2>
          <p>For each print sold, we take out the costs of that order:</p>
          <ul>
            <li>Printing, packing and shipping the print (and the frame, if chosen)</li>
            <li>Payment processing fees</li>
            <li>A small per-print hosting fee</li>
          </ul>
          <p>What&apos;s left is the profit, and it&apos;s split:</p>
          <ul>
            <li>
              <strong>Free plan: {pct(FREE_SPLIT)} to you</strong>, {pct(1 - FREE_SPLIT)} to Artfinity
            </li>
            <li>
              <strong>
                Infinity plan ({proPrice()} a month): {pct(PRO.split)} to you
              </strong>
              , {pct(1 - PRO.split)} to Artfinity
              {PRO.monthlyPrintCap ? `, on up to ${PRO.monthlyPrintCap} prints a month (prints past that are paid at the Free split)` : ""}
            </li>
          </ul>
          <p>
            Your split is set when the order is placed: if Infinity is active that day, the sale gets the Infinity split. Infinity months earned through referrals count the same way.
          </p>
          <p>Costs can change with supplier prices and payment fees. You can see each sale&apos;s costs and your share in the Studio.</p>
        </div>

        <div>
          <h2>8. Payouts</h2>
          <ul>
            <li>
              Each sale stays pending for {RETURN_WINDOW_DAYS} days after the order, our return window, so a reprint or refund can be settled first.
            </li>
            <li>
              Earnings are paid monthly: each month&apos;s sales are paid by the {ordinal(PAYOUT_DAY_OF_MONTH)} of the following month.
            </li>
            <li>We send payouts by Venmo to the handle in your account. Please keep it up to date.</li>
          </ul>
        </div>

        <div>
          <h2>9. Taxes</h2>
          <p>You are an independent seller. You report the income you get from Artfinity and pay any taxes on it. Artfinity doesn&apos;t withhold taxes for you.</p>
        </div>

        <div>
          <h2>10. Closing your account</h2>
          <ul>
            <li>You can remove any work, or close your account, at any time.</li>
            <li>When you close your account, your artist page and art go offline right away.</li>
            <li>Earnings you haven&apos;t been paid yet are still paid out on the normal schedule.</li>
          </ul>
          <p>Artfinity may suspend or close an account that breaks these terms or misuses the platform. Earnings from completed orders are still paid on the normal schedule.</p>
        </div>

        <div>
          <h2>11. Independent relationship</h2>
          <p>You are an independent contractor. This agreement doesn&apos;t create a partnership, joint venture or employment.</p>
        </div>

        <div>
          <h2>12. Changes</h2>
          <p>We may update these terms. Changes take effect when posted here, with a new date at the top. Using Artfinity after that means you accept them.</p>
        </div>
      </section>
    </LongForm>
  );
}
