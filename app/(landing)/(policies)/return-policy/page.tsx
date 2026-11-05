import type { Metadata } from "next";
import LongForm from "@/components/browse/LongForm";

export const metadata: Metadata = { title: "Return policy" };

export default function Page() {
  return (
    <LongForm eyebrow="Policy" title="Return policy" sub="Arrives damaged? We reprint it free." current="/return-policy">
      <section>
        <p className="!mt-0 !text-[14px] text-ink-2">Last updated: November 5, 2026</p>

        <div>
          <h2>Damaged, misprinted or wrong</h2>
          <p>We&apos;ll make it right, at no cost to you.</p>
          <ul>
            <li>Within 14 days of delivery, tap &ldquo;Problem with your print?&rdquo; in your shipping email and add a photo. No need to send it back.</li>
            <li>
              No email handy? Write to <a href="mailto:support@theartfinity.com">support@theartfinity.com</a> with your order number and a photo.
            </li>
            <li>We reprint and reship it free. If a reprint won&apos;t fix it, we refund you to your original payment method.</li>
          </ul>
        </div>

        <div>
          <h2>Change of mind</h2>
          <p>
            Each print is made to order, just for you, so we can&apos;t take returns or exchanges for a change of mind or a wrong size choice. Check the size tiles on the buy page,
            they show the print&apos;s size in inches.
          </p>
        </div>

        <div>
          <h2>Shipping</h2>
          <p>US shipping is free, and so is shipping on every reprint.</p>
        </div>

        <div>
          <h2>Questions</h2>
          <p>
            Write to <a href="mailto:support@theartfinity.com">support@theartfinity.com</a>.
          </p>
        </div>
      </section>
    </LongForm>
  );
}
