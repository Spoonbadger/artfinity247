export default function ArtistTermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold mb-2">
        Artist Terms & Agreement
      </h1>
      <p className="text-sm text-gray-500 mb-10">
        ARTFINITY ARTIST PLATFORM AGREEMENT
      </p>

      <section className="space-y-10 text-sm leading-7">
        
        {/* 1 */}
        <div>
          <h2 className="text-lg font-semibold mb-3">1. Eligibility</h2>
          <p className="mb-3">
            To sell artwork on Artfinity, you must:
          </p>
          <ul className="list-disc ml-6 space-y-1">
            <li>Be at least 18 years old</li>
            <li>Be a resident of the United States</li>
            <li>Have a valid Venmo account capable of receiving payments</li>
          </ul>
          <p className="mt-3">
            By registering as an artist, you represent that this information is accurate.
          </p>
        </div>

        {/* 2 */}
        <div>
          <h2 className="text-lg font-semibold mb-3">2. License to Artfinity</h2>
          <p>
            You retain full ownership of your artwork.
          </p>
          <p className="mt-3">
            By uploading artwork to Artfinity, you grant Artfinity a non-exclusive, worldwide license to:
          </p>
          <ul className="list-disc ml-6 space-y-1 mt-2">
            <li>Display your artwork on the website and marketing materials</li>
            <li>Reproduce your artwork for the purpose of producing and fulfilling print orders</li>
            <li>Promote your artwork in connection with the platform</li>
          </ul>
          <p className="mt-3">
            This license remains in effect while your artwork is listed on the platform.
          </p>
        </div>

        {/* 3 */}
        <div>
          <h2 className="text-lg font-semibold mb-3">3. Pricing & Profit Structure</h2>
          <p>
            Artfinity sets retail pricing for print sizes.
          </p>

          <p className="mt-3 font-medium">
            When a print is sold:
          </p>

          <p className="mt-2">
            Production and operating costs are deducted. These may include:
          </p>

          <ul className="list-disc ml-6 space-y-1 mt-2">
            <li>Printing costs</li>
            <li>Shipping and packaging</li>
            <li>Payment processing fees</li>
            <li>Platform hosting and operational expenses</li>
            <li>Fulfillment and handling</li>
          </ul>

          <p className="mt-4">
            The remaining <strong>net profit</strong> is split:
          </p>

          <ul className="list-disc ml-6 space-y-1 mt-2">
            <li><strong>50% to the Artist</strong></li>
            <li><strong>50% to Artfinity</strong></li>
          </ul>

          <p className="mt-4">
            Net profit is defined as the sale price minus all direct production and operational costs associated with fulfilling the order.
          </p>

          <p className="mt-3">
            Costs may change over time based on supplier pricing, payment processor fees, or operational expenses.
          </p>
        </div>

        {/* 4 */}
        <div>
          <h2 className="text-lg font-semibold mb-3">4. Payout Schedule</h2>
          <ul className="list-disc ml-6 space-y-1">
            <li>Artist earnings are calculated monthly.</li>
            <li>Payouts are issued by the 5th day of the following month.</li>
            <li>Payments are sent via Venmo to the handle provided in your account.</li>
          </ul>
          <p className="mt-3">
            It is the artist’s responsibility to ensure their Venmo details are accurate.
          </p>
        </div>

        {/* 5 */}
        <div>
          <h2 className="text-lg font-semibold mb-3">5. Taxes</h2>
          <p>
            Artists are independent sellers and are responsible for:
          </p>
          <ul className="list-disc ml-6 space-y-1 mt-2">
            <li>Reporting income received from Artfinity</li>
            <li>Paying any applicable federal, state, or local taxes</li>
          </ul>
          <p className="mt-3">
            Artfinity does not withhold taxes on behalf of artists.
          </p>
        </div>

        {/* 6 */}
        <div>
          <h2 className="text-lg font-semibold mb-3">6. Content Standards</h2>
          <p>You agree not to upload artwork that:</p>
          <ul className="list-disc ml-6 space-y-1 mt-2">
            <li>Infringes on copyright or trademark rights</li>
            <li>Contains unlawful, defamatory, or obscene material</li>
            <li>Violates any applicable laws</li>
          </ul>
          <p className="mt-3">
            Artfinity reserves the right to remove artwork or suspend accounts at its discretion.
          </p>
        </div>

        {/* 7 */}
        <div>
          <h2 className="text-lg font-semibold mb-3">7. Termination</h2>
          <p>
            You may remove your artwork at any time.
          </p>
          <p className="mt-3">
            Artfinity reserves the right to suspend or terminate artist accounts for violation of these Terms or misuse of the platform.
          </p>
          <p className="mt-3">
            Any outstanding earnings for completed orders will be paid according to the regular payout schedule.
          </p>
        </div>

        {/* 8 */}
        <div>
          <h2 className="text-lg font-semibold mb-3">8. Independent Relationship</h2>
          <p>
            Artists are independent contractors.
          </p>
          <p className="mt-3">
            Nothing in this Agreement creates a partnership, joint venture, or employment relationship.
          </p>
        </div>

        {/* 9 */}
        <div>
          <h2 className="text-lg font-semibold mb-3">9. Modifications</h2>
          <p>
            Artfinity may update these Terms from time to time. Continued use of the platform after updates constitutes acceptance of the revised Terms.
          </p>
        </div>

      </section>
    </div>
  )
}