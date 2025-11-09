import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import {
  Earth,
  Facebook,
  Instagram,
  Linkedin,
  Mail,
  Twitter,
} from "lucide-react";
import { SocialAccountType } from "@/types";

const SocialAccountLinks = ({
  links = [],
  icons = true,
  className,
}: {
  links?: SocialAccountType[];
  icons?: boolean;
  className?: string;
}): ReactNode => {
  return icons ? (
    <div
      className={cn(
        "social-wrapper flex gap-2 md:gap-3",
        "[&>a>*]:aspect-square [&>a>*]:w-4 [&>a>*]:lg:w-4 [&_a]:opacity-85 hover:[&_a]:opacity-100",
        className,
      )}
    >
      {/* {links.map((linkObj, index) => (
        <Link key={index} href={linkObj.url} target="_blank">
          {linkObj.platform?.toLowerCase() === "facebook" ? (
            <Facebook />
          ) : linkObj.platform?.toLowerCase() === "instagram" ? (
            <Instagram />
          ) : linkObj.platform?.toLowerCase() === "twitter" ? (
            <Twitter />
          ) : linkObj.platform?.toLowerCase() === "linkedin" ? (
            <Linkedin />
          ) : linkObj.platform?.toLowerCase() === "mail" ? (
            <Mail />
          ) : (
            <Earth />
          )}
        </Link>
      ))} */}
    </div>
  ) : (
    <ul className={cn("social-list capitalize", className)}>
      {links.map((linkObj, index) => {
        if (!linkObj.platform) {
          return null;
        }

        return (
          <li key={index} className="social-item">
            <Link
              className={cn("social-link opacity-85  hover:opacity-100")}
              href={linkObj.url}
              target="_blank"
            >
              {linkObj.platform}
            </Link>
          </li>
        );
      })}
    </ul>
  );
};

export default SocialAccountLinks;
