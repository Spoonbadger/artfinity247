"use client";

import { ReactNode, useEffect, useState } from "react";
import { MaxWidthWrapper } from "@/components/layout";
import { getAppConfigs, getAppPages } from "@/db/query";

const AppConfigs = getAppConfigs();
const AppPages = getAppPages();

const TermsAndConditionsPage = (): ReactNode => {
  const [title, setTitle] = useState<string>("");
  const [subTitle, setSubTitle] = useState<string>("");
  const [content, setContent] = useState<string>("");

  useEffect(() => {
    const { title, subTitle, content } = AppPages.terms_and_conditions;

    setTitle((prev) => title);
    setSubTitle((prev) => subTitle);
    setContent((prev) => content);
  }, []);
  return (
    <div>
      <title>{`${title || "Terms and Conditions"}: ${AppConfigs.app_name}`}</title>
      <section>
        <MaxWidthWrapper className="mb-12 md:mb-20">
          <h1 className="area-title my-4 mt-8 text-center">{title}</h1>
          <h5 className="area-sub-title mb-6 text-center text-muted-foreground">
            {subTitle}
          </h5>
          <p
            className="area-text mb-4 text-justify"
            dangerouslySetInnerHTML={{ __html: content }}
            suppressHydrationWarning={true}
          />
        </MaxWidthWrapper>
      </section>
    </div>
  );
};

export default TermsAndConditionsPage;
