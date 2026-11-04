import { redirect } from "next/navigation";

// Purchases moved into the artist Studio.
export default function MyPurchasesPage() {
  redirect("/studio/purchases");
}
