import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Brushed } from "@/components/af/Brush";
import { StudioPage } from "@/components/studio/StudioPage";
import EmailEditor, { type EditorTemplate } from "@/components/crm/EmailEditor";
import { DEFAULT_TEMPLATES, EMAIL_KINDS, type EmailKind } from "@/lib/artistEmails";
import { displayName, requireArtist } from "../_lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Automated emails" };

export default async function EmailsPage() {
  const artist = await requireArtist("/studio/emails");
  const [rows, art] = await Promise.all([
    prisma.emailTemplate.findMany({ where: { artistId: artist.id } }),
    prisma.artwork.findFirst({
      where: { artistId: artist.id, status: "APPROVED" },
      orderBy: { OrderItem: { _count: "desc" } },
      select: { title: true },
    }),
  ]);

  const templates = Object.fromEntries(
    EMAIL_KINDS.map((k) => {
      const r = rows.find((x) => x.kind === k);
      const t: EditorTemplate = r
        ? { subject: r.subject, body: r.body, enabled: r.enabled, custom: true }
        : { ...DEFAULT_TEMPLATES[k], enabled: true, custom: false };
      return [k, t];
    })
  ) as Record<EmailKind, EditorTemplate>;

  return (
    <StudioPage
      title={<>Automated <Brushed>emails</Brushed></>}
      sub="What buyers get, in your words."
      actions={
        <Link href="/studio/customers" className="btn btn-ghost btn-sm">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />Customers
        </Link>
      }
    >
      <EmailEditor
        initial={templates}
        artistName={displayName(artist)}
        sampleTitle={art?.title || "Golden Hour"}
      />
    </StudioPage>
  );
}
