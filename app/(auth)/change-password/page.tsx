"use client";

import { ReactNode, useEffect, useState } from "react";
import { MaxWidthWrapper } from "@/components/layout";
import { ChangePasswordForm } from "@/components/forms";
import { getAppConfigs, getAppPages } from "@/db/query";

const AppConfigs = getAppConfigs();
const AppPages = getAppPages();

const ChangePasswordPage = (): ReactNode => {
  const [title, setTitle] = useState<string>("");

  useEffect(() => {
    const { title } = AppPages.change_password;

    setTitle((prev) => title);
  }, []);

  return (
    <div>
      <title>{`${title || "Change Password"}: ${AppConfigs.app_name}`}</title>
      <MaxWidthWrapper className="p-5 md:py-20">
        <div className="mx-auto max-w-[600px] rounded-sm border-theme-primary-100 md:border md:p-8">
          <ChangePasswordForm title={title || "Change Password"} />
        </div>
      </MaxWidthWrapper>
    </div>
  );
};

export default ChangePasswordPage;
