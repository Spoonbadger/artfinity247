export default function SellWithUsPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold mb-2">
        Sell With Us
      </h1>
      <p className="text-sm text-gray-500 mb-10">
        ARTIST FAQ
      </p>

      <div className="space-y-10 text-sm leading-7">

        {/* How it works */}
        <section>
          <h2 className="text-lg font-semibold mb-3">
            How does selling on Artfinity work?
          </h2>
          <p>
            Upload your artwork, set up your profile, and we handle the rest.
            When a customer orders a print, we manage production, packaging,
            payment processing, and shipping directly to the buyer.
          </p>
          <p className="mt-3">
            You don’t pay upfront costs and you don’t manage inventory.
          </p>
        </section>

        {/* Earnings */}
        <section>
          <h2 className="text-lg font-semibold mb-3">
            How do I get paid?
          </h2>
          <p>
            After production and operating costs are covered, net profit from
            each sale is split:
          </p>
          <ul className="list-disc ml-6 mt-2 space-y-1">
            <li><strong>50% to you (the artist)</strong></li>
            <li><strong>50% to Artfinity</strong></li>
          </ul>
          <p className="mt-3">
            Payouts are calculated monthly and sent via Venmo by the 5th of the
            following month.
          </p>
        </section>

        {/* Example */}
        <section>
          <h2 className="text-lg font-semibold mb-3">
            Example Earnings
          </h2>
          <p>
            For a Medium print sold at <strong>$44.99</strong>:
          </p>
          <ul className="list-disc ml-6 mt-2 space-y-1">
            <li>Production, shipping, and payment costs are deducted first</li>
            <li>Remaining net profit is approximately $21</li>
            <li>Your share: approximately <strong>$10–11 per print</strong></li>
          </ul>
          <p className="mt-3">
            Larger print sizes generate higher payouts.
          </p>
        </section>

        {/* Why this structure */}
        <section>
          <h2 className="text-lg font-semibold mb-3">
            Why this structure?
          </h2>
          <p>
            This model allows you to earn from your work without paying upfront
            for printing, shipping, or marketing and no sign-up fees or subscriptions. Every sale is upside — no
            inventory risk or no production management.
          </p>
        </section>

        {/* Taxes */}
        <section>
          <h2 className="text-lg font-semibold mb-3">
            What about taxes?
          </h2>
          <p>
            Artists are responsible for reporting and paying their own taxes.
            Artfinity does not withhold taxes on your behalf.
          </p>
        </section>

      </div>
    </div>
  );
}