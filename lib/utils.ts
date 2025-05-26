import { NavLink } from "@/types";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export { useIntersectionObserver } from "./client-only/useIntersectionObserver";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const flattenNavLinks = (links: NavLink[]): NavLink[] => {
  const flatMenu = [];
  for (const item of links) {
    const { subMenu, ...linkObj } = item;
    flatMenu.push(linkObj);
    if (subMenu) {
      flatMenu.push(...flattenNavLinks(subMenu));
    }
  }
  return flatMenu;
};

export const shuffleArray = (arr: any) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]; // Swap elements
  }
  return arr;
};
