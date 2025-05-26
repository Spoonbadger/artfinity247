import { ReactNode } from "react";
import Link from "next/link";
import { cn, flattenNavLinks } from "@/lib/utils";
import { NavLink } from "@/types";

const NavLinks = ({
  links = [],
  className,
  flatten = false,
  pathname,
}: {
  links?: NavLink[];
  className?: string;
  flatten?: boolean;
  pathname?: string;
}): ReactNode => {
  const navLinks: NavLink[] = flatten ? flattenNavLinks(links) : links;

  const generateNavLinks = (links: NavLink[]) => {
    return (
      <ul className="nav-list">
        {links.map((linkObj, index) => {
          if (!linkObj.title) {
            return null;
          }

          const subMenu = linkObj.subMenu;

          return (
            <li
              key={index}
              className={cn("nav-item", subMenu && "has-sub-menu")}
            >
              <Link
                className={cn(
                  "nav-link w-full",
                  pathname && pathname === linkObj.href && "active",
                )}
                href={linkObj.href}
                target={linkObj.openInNewTab ? "_blank" : "_self"}
              >
                {linkObj.title}
              </Link>
              {subMenu && generateNavLinks(subMenu)}
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <nav className={cn("nav-menu w-full capitalize", className)}>
      {generateNavLinks(navLinks)}
    </nav>
  );
};

export default NavLinks;
