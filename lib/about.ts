// Everything the About page says about the people and the company. Edit here.
import AppConfigs from "@/db/json/AppConfigs.json";

export type TeamMember = {
  name: string;
  role: string;
  /** Square photo in /public, e.g. "/team/thomas.jpg". Without one, a painted initial shows. */
  photo?: string;
  /** One or two short sentences, first person. */
  note: string;
  /** Paint color behind the initial. */
  color: string;
};

// TODO(Thomas): confirm names, roles and notes, and add photos.
export const TEAM: TeamMember[] = [
  {
    name: "Thomas Demuth",
    role: "Founder",
    note: "I started Artfinity so the art on café and market walls is as easy to buy as the coffee next to it.",
    color: "var(--af-scan)",
  },
];

// TODO(Thomas): the story in your words. Two or three short paragraphs.
export const STORY: string[] = [
  "Every town has painters whose work hangs in cafés, markets and shows. People stop and look, but buying it means finding the artist, emailing, waiting.",
  "Artfinity puts a code next to the painting. Scan it, pick a size, done. We print it, ship it, and send most of the profit to the artist.",
];

export const COMPANY = {
  // TODO(Thomas): legal company name once it's registered, e.g. "Artfinity LLC".
  legalName: AppConfigs.business_name,
  address: AppConfigs.business_address,
  email: AppConfigs.business_email,
  supportEmail: AppConfigs.support_email,
  phone: AppConfigs.business_phone,
  hours: "Mon–Fri, 8 a.m.–4 p.m. ET",
};
