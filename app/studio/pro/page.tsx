import { redirect } from "next/navigation";

// The plan was renamed from Pro to Infinity.
export default function ProRedirect() {
  redirect("/studio/infinity");
}
