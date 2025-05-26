import { ActionButtonType } from "@/types/buttons";

export type GenericSectonType = {
  title: string;
  subTitle?: string;
  content?: string;
  banner?: string;
  slug?: string;
  actionBtns?: ActionButtonType[];
};
