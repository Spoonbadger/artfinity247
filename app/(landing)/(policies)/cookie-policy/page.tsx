import type { Metadata } from "next";
import { HtmlPolicy } from "@/components/browse/LongForm";
import { getAppPages } from "@/db/query";

const page = getAppPages().cookie_policy;

export const metadata: Metadata = { title: "Cookie policy" };

export default function Page() {
  return <HtmlPolicy title="Cookie policy" sub={page.subTitle} html={page.content} current="/cookie-policy" />;
}
