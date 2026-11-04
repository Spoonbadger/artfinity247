import type { Metadata } from "next";
import { HtmlPolicy } from "@/components/browse/LongForm";
import { getAppPages } from "@/db/query";

const page = getAppPages().return_policy;

export const metadata: Metadata = { title: "Return policy" };

export default function Page() {
  return <HtmlPolicy title="Return policy" sub={page.subTitle} html={page.content} current="/return-policy" />;
}
