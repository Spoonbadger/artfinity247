import { redirect } from "next/navigation";

// The print queue became Print codes (/studio/print). Old links, bookmarks and Stripe returns land there, with
// anything still queued ticked (lib/printPreset.ts).
export default function OldPrintQueue({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const keep = new URLSearchParams();
  for (const k of ["paid", "session_id", "canceled"]) if (searchParams[k]) keep.set(k, searchParams[k]!);
  redirect(`/studio/print${keep.size ? `?${keep}` : ""}`);
}
