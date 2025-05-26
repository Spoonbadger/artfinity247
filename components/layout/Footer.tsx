import React from "react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import Image from "next/image";
import { MaxWidthWrapper } from "@/components/layout";
import NavLinks from "@/components/NavLinks";
import SocialAccountLinks from "@/components/SocialAccountLinks";
import { SubscribeForm } from "@/components/forms";
import { MinimalSection } from "@/components/sections";
import { getAppConfigs, getAppMenus } from "@/db/query";
import { SocialAccountType } from "@/types";

const AppConfigs = getAppConfigs();
const { primary: primaryNavLinks, policies: policyNavLinks } = getAppMenus();
export const socialMediaLinks: SocialAccountType[] = AppConfigs.social_accounts;

const Footer = () => {
  return (
    <footer
      className={cn(
        "text-slate-800 dark:text-slate-100",
        "font-secondary dark:bg-background [&>*:not(:last-child)]:mb-5 [&>*]:border-t-2 [&>*]:border-theme-primary-100 [&>*]:border-opacity-50",
      )}
    >
      <div className="footer-top relative isolate !mb-0">
        <MaxWidthWrapper className="py-12 md:py-16">
          <MinimalSection className="mx-auto max-w-screen-lg items-center justify-center md:grid-cols-2 md:gap-8">
            <div className="space-y-2">
              <h5 className="area-sub-title font-quaternary uppercase text-muted-foreground md:text-start">
                Stay Connected
              </h5>
              <h2 className="area-title font-primary font-normal md:text-start md:text-5xl">
                Subscribe
              </h2>
            </div>
            <div className="area-content">
              <SubscribeForm
                className={cn(
                  "mx-auto min-w-60 sm:w-80 md:me-0 md:w-full md:max-w-[400px]",
                  "[&_.area-text]:text-center [&_.area-text]:md:text-start",
                )}
              />
            </div>
          </MinimalSection>
        </MaxWidthWrapper>
      </div>
      <div
        className={cn(
          "footer-middle",
          "[&_.footer-wrapper>h4]:mb-2 [&_.nav-item]:mb-1 [&_.nav-link]:w-fit [&_.nav-link]:text-start [&_.nav-link]:text-lg",
        )}
      >
        <MaxWidthWrapper>
          <div className="my-10 grid gap-x-12 gap-y-8 md:my-14 md:grid-cols-3 md:gap-x-16 md:gap-y-12 lg:my-20 lg:grid-cols-4 lg:gap-x-28">
            <div className="footer-wrapper row-span-0 md:row-span-3">
              <div className="logo-wrapper">
                <Image
                  src={AppConfigs.footer_logo || "/assets/images/logo.png"}
                  alt="App logo"
                  className="mb-4 w-36 object-contain md:w-48"
                  width={195}
                  height={65}
                />
              </div>
              <div className="app-info-wrapper">
                <p className="max-w-96 leading-loose">
                  {AppConfigs.app_description || "This is a demo app."}
                </p>
              </div>
            </div>
            <div className="footer-wrapper whitespace-nowrap">
              <h4>Shortcuts</h4>
              <NavLinks
                className="[&_a.nav-link]:text-sm"
                links={primaryNavLinks}
                flatten={true}
              />
            </div>
            <div className="footer-wrapper whitespace-nowrap">
              <h4>Our Policies</h4>
              <NavLinks
                className="[&_a.nav-link]:text-sm"
                links={policyNavLinks}
                flatten={true}
              />
            </div>
            <div className="footer-wrapper whitespace-nowrap">
              <h4>Connect with Us</h4>
              <SocialAccountLinks
                links={socialMediaLinks}
                className="[&_a.nav-link]:text-sm"
                icons={false}
              />
            </div>
            <div className="footer-wrapper">
              <h4>Contacts</h4>
              <ul className="nav-list">
                <li className="nav-item">
                  <div className="business-info max-w-96 text-sm leading-loose">
                    <p className="contact">
                      <span className="business-email">
                        <Link href={`tel:${AppConfigs.business_phone}`}>
                          {AppConfigs.business_phone}
                        </Link>
                      </span>
                      <br />
                      <span className="business-email">
                        <Link href={`mailto:${AppConfigs.business_email}`}>
                          {AppConfigs.business_email}
                        </Link>
                      </span>
                    </p>
                    <p className="address text-sm leading-loose">
                      {AppConfigs.business_name}, <br />
                      {AppConfigs.business_address}
                    </p>
                  </div>
                </li>
              </ul>
            </div>
            {AppConfigs.business_open_time && (
              <div className="footer-wrapper">
                <h4>Open Hours</h4>
                <ul className="nav-list">
                  <li className="nav-item">
                    <p className="max-w-96 text-sm leading-relaxed">
                      {AppConfigs.business_open_time}
                    </p>
                  </li>
                </ul>
              </div>
            )}
          </div>
        </MaxWidthWrapper>
      </div>
      <div className="footer-bottom py-3 md:py-4 lg:py-6">
        <MaxWidthWrapper>
          <div className="flex items-center justify-center">
            <p className="whitespace-nowrap text-center text-xs capitalize sm:text-sm">
              <span className="text-sm font-bold sm:text-base">
                {AppConfigs.app_name || "Demo App"}
              </span>{" "}
              &copy; {new Date().getFullYear()} / All Rights Reserved
            </p>
          </div>
        </MaxWidthWrapper>
      </div>
    </footer>
  );
};

export default Footer;
