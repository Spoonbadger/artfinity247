import type { Metadata } from "next";
import LongForm from "@/components/browse/LongForm";

export const metadata: Metadata = { title: "Artist terms and agreement" };

export default function ArtistTermsPage() {
  return (
    <LongForm eyebrow="For artists" title="Artist terms and agreement" sub="Artfinity artist platform agreement" current="/artist-terms-and-agreement">
      <section>
        
        {/* 1 */}
        <div>
          <h2>1. Eligibility</h2>
          <p>
            To sell artwork on Artfinity, you must:
          </p>
          <ul>
            <li>Be at least 18 years old</li>
            <li>Be a resident of the United States</li>
            <li>Have a valid Venmo account capable of receiving payments</li>
          </ul>
          <p>
            By registering as an artist, you represent that this information is accurate.
          </p>
        </div>

        {/* 2 */}
        <div>
          <h2>2. License to Artfinity</h2>
          <p>
            You retain full ownership of your artwork.
          </p>
          <p>
            By uploading artwork to Artfinity, you grant Artfinity a non-exclusive, worldwide license to:
          </p>
          <ul>
            <li>Display your artwork on the website and marketing materials</li>
            <li>Reproduce your artwork for the purpose of producing and fulfilling print orders</li>
            <li>Promote your artwork in connection with the platform</li>
          </ul>
          <p>
            This license remains in effect while your artwork is listed on the platform.
          </p>
        </div>

        {/* 3 */}
        <div>
          <h2>3. Pricing & Profit Structure</h2>
          <p>
            Artfinity sets retail pricing for print sizes.
          </p>

          <p>
            When a print is sold:
          </p>

          <p>
            Production and operating costs are deducted. These may include:
          </p>

          <ul>
            <li>Printing costs</li>
            <li>Shipping and packaging</li>
            <li>Payment processing fees</li>
            <li>Platform hosting and operational expenses</li>
            <li>Fulfillment and handling</li>
          </ul>

          <p>
            The remaining <strong>net profit</strong> is split:
          </p>

          <ul>
            <li><strong>60% to the Artist</strong></li>
            <li><strong>40% to Artfinity</strong></li>
          </ul>

          <p>
            Net profit is defined as the sale price minus all direct production and operational costs associated with fulfilling the order.
          </p>

          <p>
            Costs may change over time based on supplier pricing, payment processor fees, or operational expenses.
          </p>
        </div>

        {/* 4 */}
        <div>
          <h2>4. Payout Schedule</h2>
          <ul>
            <li>Artist earnings are calculated monthly.</li>
            <li>Payouts are issued by the 5th day of the following month.</li>
            <li>Payments are sent via Venmo to the handle provided in your account.</li>
          </ul>
          <p>
            It is the artist’s responsibility to ensure their Venmo details are accurate.
          </p>
        </div>

        {/* 5 */}
        <div>
          <h2>5. Taxes</h2>
          <p>
            Artists are independent sellers and are responsible for:
          </p>
          <ul>
            <li>Reporting income received from Artfinity</li>
            <li>Paying any applicable federal, state, or local taxes</li>
          </ul>
          <p>
            Artfinity does not withhold taxes on behalf of artists.
          </p>
        </div>

        {/* 6 */}
        <div>
          <h2>6. Content Standards</h2>
          <p>You agree not to upload artwork that:</p>
          <ul>
            <li>Infringes on copyright or trademark rights</li>
            <li>Contains unlawful, defamatory, or obscene material</li>
            <li>Violates any applicable laws</li>
          </ul>
          <p>
            Artfinity reserves the right to remove artwork or suspend accounts at its discretion.
          </p>
        </div>

        {/* 7 */}
        <div>
          <h2>7. Termination</h2>
          <p>
            You may remove your artwork at any time.
          </p>
          <p>
            Artfinity reserves the right to suspend or terminate artist accounts for violation of these Terms or misuse of the platform.
          </p>
          <p>
            Any outstanding earnings for completed orders will be paid according to the regular payout schedule.
          </p>
        </div>

        {/* 8 */}
        <div>
          <h2>8. Independent Relationship</h2>
          <p>
            Artists are independent contractors.
          </p>
          <p>
            Nothing in this Agreement creates a partnership, joint venture, or employment relationship.
          </p>
        </div>

        {/* 9 */}
        <div>
          <h2>9. Modifications</h2>
          <p>
            Artfinity may update these Terms from time to time. Continued use of the platform after updates constitutes acceptance of the revised Terms.
          </p>
        </div>

      </section>
    </LongForm>
  )
}
