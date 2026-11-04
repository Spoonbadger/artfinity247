import type { Metadata } from "next";
import { HtmlPolicy } from "@/components/browse/LongForm";
import { getAppPages } from "@/db/query";

const page = getAppPages().privacy_policy;

export const metadata: Metadata = { title: "Privacy policy" };

export default function Page() {
  return <HtmlPolicy title="Privacy policy" sub={page.subTitle} html={page.content} current="/privacy-policy" />;
}
