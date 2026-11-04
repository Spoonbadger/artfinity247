import type { Metadata } from "next";
import { HtmlPolicy } from "@/components/browse/LongForm";
import { getAppPages } from "@/db/query";

const page = getAppPages().terms_and_conditions;

export const metadata: Metadata = { title: "Terms and conditions" };

export default function Page() {
  return <HtmlPolicy title="Terms and conditions" sub={page.subTitle} html={page.content} current="/terms-and-conditions" />;
}
