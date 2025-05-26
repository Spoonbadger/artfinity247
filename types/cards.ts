import { SocialAccountType } from "@/types/db";

export type OurGuaranteeCardType = {
  _id?: string;
  title: string;
  img: string;
  description?: string;
};

export type AnimatedCounterCardType = {
  title: string;
  value: number;
  content?: string;
  prefix?: string;
  suffix?: string;
  duration?: number;
};

export type MemberInfoCardType = {
  name: string;
  position: string;
  img: string;
  description?: string;
  social_accounts: SocialAccountType[];
};
