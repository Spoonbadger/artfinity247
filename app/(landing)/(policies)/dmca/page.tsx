import type { Metadata } from "next";
import Link from "next/link";
import LongForm from "@/components/browse/LongForm";
import AppConfigs from "@/db/json/AppConfigs.json";

export const metadata: Metadata = { title: "Copyright and DMCA", description: "How to report copied art on Artfinity, and how artists file a counter-notice." };

// TODO(owner): replace with the agent registered at copyright.gov/dmca-directory.
const AGENT = {
  name: "Copyright Agent, Artfinity",
  address: AppConfigs.business_address.replace(/,\s*United States$/, "").replace(/, (\d{5})/, " $1"),
  email: AppConfigs.business_email,
  phone: AppConfigs.business_phone,
};

export default function Page() {
  return (
    <LongForm eyebrow="Policy" title="Copyright and DMCA" sub="Artists should only sell their own work. Here’s how we handle copied art." current="/dmca">
      <h2>Report copied art</h2>
      <p>
        If someone is selling your work on Artfinity, <Link href="/report">fill in the report form</Link> and choose “It’s my work / copied.” It asks for
        everything a DMCA notice needs: your original work, the Artfinity link, your contact details, two short statements and your typed signature.
      </p>
      <p>Not the owner? You can still report AI-made or harmful work on the same form.</p>

      <h2>What happens next</h2>
      <ul>
        <li>A person reviews every notice, usually within 2 business days.</li>
        <li>If it’s valid, we take the work down quickly and tell the artist why.</li>
        <li>We email you when it’s done.</li>
        <li>Artists who keep uploading other people’s work lose their account.</li>
      </ul>

      <h2>If your work was taken down</h2>
      <p>
        If you believe it was removed by mistake, you can send a counter-notice. Log in and use the link in your takedown email. You’ll give your contact details, a statement under penalty of perjury that the
        removal was a mistake, your consent to the jurisdiction of a federal court, and your typed signature.
      </p>
      <p>
        We send a copy to the person who filed the notice. If they don’t tell us within 10 business days that they’ve gone to court, we put your work back
        up within 14 business days.
      </p>
      <p>Filing a false notice or counter-notice can make you liable for damages, so only file one if you’re sure.</p>

      <h2>Designated agent</h2>
      <p>You can also send a written notice to our copyright agent:</p>
      <p>
        <strong>{AGENT.name}</strong>
        <br />
        {AGENT.address}
        <br />
        <a href={`mailto:${AGENT.email}?subject=DMCA%20notice`}>{AGENT.email}</a>
        <br />
        {AGENT.phone}
      </p>
      <p>
        Questions that aren’t about copyright? <Link href="/contact">Contact us</Link>.
      </p>
    </LongForm>
  );
}
