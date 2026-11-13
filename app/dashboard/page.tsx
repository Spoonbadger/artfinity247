import { redirect } from "next/navigation";

// Old dashboard route. The artist Studio replaced it.
export default function Page() {
  redirect("/studio");
}
