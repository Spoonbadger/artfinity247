"use client";

import { ReactNode, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useCart } from "@/components/contexts";
import { usePathname } from "next/navigation";
import { MenuIcon, ShoppingCart, User } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { MaxWidthWrapper } from "@/components/layout";
import SearchArea from "@/components/SearchArea";
import NavLinks from "@/components/NavLinks";
import SocialAccountLinks from "@/components/SocialAccountLinks";
import { getAppConfigs, getAppMenus, getAppPages } from "@/db/query";
import { SocialAccountType } from "@/types";
import { Badge } from "@/components/ui/badge";
import { useUser } from '@/components/contexts/UserProvider'

const AppConfigs = getAppConfigs();
const AppPages = getAppPages();

const {
  primary: primaryNavLinks,
  primary_shortcuts: primaryShortcutsNavLinks,
} = getAppMenus();
export const socialMediaLinks: SocialAccountType[] = AppConfigs.social_accounts;

const NavBar = ({
  className,
  fixedNav = true,
}: {
  className?: string;
  fixedNav: boolean;
}): ReactNode => {
  const pathname = usePathname();

  const [isScrolled, setIsScrolled] = useState(false);

  const { cartItems } = useCart();

  const { currentUser } = useUser()
  const loginSlug = AppPages.login.slug || "login"
  const profileHref = currentUser?.slug ? `/artists/${currentUser.slug}` : `/${loginSlug}`
  // Fix later:
  // const avatar = currentUser?.profileImage || "/assets/images/icons/users/generic-user-profile-picture.png"

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 100); // Set Scroll threshold
    };

    handleScroll();

    // Set Event Listeners
    window.addEventListener("scroll", handleScroll);
    window.addEventListener("load", handleScroll);
    window.addEventListener("resize", handleScroll);

    return () => {
      // Remove Event Listeners
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("load", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  return (
    <header
      className={cn(
        "select-none bg-white transition-all duration-200 ease-in-out",
        fixedNav && "fixed left-0 right-0 top-0 z-30",
        fixedNav && !isScrolled && "md:bg-transparent",
        fixedNav &&
          !isScrolled &&
          "md:[&_.lucide]:text-white md:[&_a]:text-white",
        fixedNav && isScrolled && "shadow-md",
        className,
      )}
    >
      <div
        className={cn(
          "hover grid font-quaternary font-bold text-theme-secondary-500 md:grid-rows-header",
          "border-opacity-40",
          "[&>*]:border-b",
          fixedNav &&
            isScrolled &&
            "md:grid-rows-header-scrolled [&>*]:border-b-0",
        )}
      >
        <div
          className={cn(
            "hidden md:block",
            fixedNav && isScrolled && "invisible opacity-0",
          )}
        >
          <MaxWidthWrapper>
            <div
              className={cn(
                "header-top flex h-full space-x-2 text-xs uppercase",
                "[&>*]:flex [&>*]:h-full [&>*]:min-w-20 [&>*]:items-center [&>*]:md:min-w-28",
              )}
            >
              <div
                className={cn(
                  "header-top-meta space-x-2",
                  "[&>*]:px-2 [&_a]:opacity-65 focus-within:[&_a]:opacity-100 hover:[&_a]:opacity-100",
                )}
              >
                {primaryShortcutsNavLinks.map((link, index) => (
                  <Link key={index} href={link.href}>
                    {link.title}
                  </Link>
                ))}
              </div>
              <div className="header-top-promo flex h-full flex-grow items-center justify-center border-x">
                <p></p>
              </div>
              <div className="header-top-social">
                <SocialAccountLinks links={socialMediaLinks} icons={true} />
              </div>
            </div>
          </MaxWidthWrapper>
        </div>
        <div className={cn("header-nav-main")}>
          <MaxWidthWrapper>
            <div
              className={cn(
                "header-middle flex h-full space-x-2 py-2 uppercase md:divide-x md:py-0",
                "[&>*]:flex [&>*]:h-full [&>*]:flex-1 [&>*]:items-center",
              )}
            >
              <div className="nav-wrapper">
                <div className="monile-nav-menu md:hidden">
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button
                        className="!bg-transparent !outline-none"
                        variant="ghost"
                      >
                        <MenuIcon />
                      </Button>
                    </SheetTrigger>
                    <SheetContent
                      className="header-nav mobile-navbar-top flex flex-col justify-between gap-4 border-theme-primary-400 bg-theme-primary-500"
                      side="left"
                    >
                      <div>
                        <NavLinks
                          links={primaryNavLinks}
                          className={cn(
                            "mt-6 w-full text-xl text-white md:mx-4",
                          )}
                          pathname={pathname}
                        />
                      </div>
                      <div>
                        <div
                          className={cn(
                            "mobile-navbar-bottom w-full space-y-5 font-secondary font-bold tracking-wider text-slate-100",
                            "[&_.lucide]:h-6 [&_.lucide]:w-6 [&_.lucide]:text-slate-100",
                          )}
                        >
                          <div className="additional-links">
                            <Link href="/login" className="flex gap-3">
                              <User />
                              Login
                            </Link>
                          </div>
                          <SocialAccountLinks icons={true} className="gap-3" />
                        </div>
                      </div>
                    </SheetContent>
                  </Sheet>
                </div>
                <Link href="/">
                  <Image
                    src={AppConfigs.header_logo || "/assets/images/logo.png"}
                    alt="App logo"
                    className={cn(
                      "app-logo w-32 object-contain md:w-44 md:min-w-24",
                      fixedNav && isScrolled && "md:w-40",
                    )}
                    width={175}
                    height={50}
                  />
                </Link>
              </div>
              <div className="nav-wrapper !hidden md:!block">
                <NavLinks
                  links={primaryNavLinks}
                  className={cn(
                    "header-nav mx-4 h-full text-sm",
                    "[&>ul.nav-list]:md:flex [&>ul.nav-list]:md:gap-3",
                  )}
                  pathname={pathname}
                />
              </div>
              <div className="action-btns-wrapper max-w-fit space-x-2 ps-4">
                <SearchArea />
                <Link
                  href={profileHref}
                  className="inline-block"
                >
                  <User />
                </Link>
                <Link
                  href={`/${AppPages.cart.slug || "cart"}`}
                  className="relative isolate"
                >
                  <ShoppingCart />
                  { cartItems.length > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -right-2 -top-2 flex aspect-square size-5 items-center justify-center rounded-full !p-0.5"
                  >
                    {cartItems?.length < 9 ? cartItems?.length : "9+"}
                  </Badge>
                  )
                }
                </Link>
              </div>
            </div>
          </MaxWidthWrapper>
        </div>
      </div>
    </header>
  );
};

export default NavBar;
