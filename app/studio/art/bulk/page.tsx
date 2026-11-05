import { redirect } from "next/navigation";

// Uploading several paintings lives in the normal upload flow now; keep old links working.
export default function BulkUploadRedirect() {
  redirect("/studio/art/new");
}
