import { redirect } from "next/navigation";

// Sales moved into the artist Studio.
export default function MySalesPage() {
  redirect("/studio/sales");
}
