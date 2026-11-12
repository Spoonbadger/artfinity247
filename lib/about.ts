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
    name: "Craig Morley",
    role: "Founder",
    note: "Founded Artfinity and built the first version of the site.",
    color: "var(--af-coral)",
  },
  {
    name: "Thomas Demuth",
    role: "User Experience",
    note: "Leading the new, artist-first Artfinity.",
    color: "var(--af-scan)",
  },
];

// TODO(Thomas): the story in your words. Two or three short paragraphs.
// TODO(thomas): confirm story wording for nationwide
export const STORY: string[] = [
  "Painters hang work in cafés, markets and shows. People stop and look. Buying it used to mean tracking down the artist and waiting on email.",
  "Artfinity puts a code next to the painting. Scan it and pick a size. We print and ship it, and most of the profit goes to the artist.",
];

export const COMPANY = {
  // TODO(Thomas): legal company name once it's registered, e.g. "Artfinity LLC".
  legalName: AppConfigs.business_name,
  address: AppConfigs.business_address,
  email: AppConfigs.business_email,
  supportEmail: AppConfigs.support_email,
  hours: "Mon–Fri, 8 a.m.–4 p.m. ET",
};
