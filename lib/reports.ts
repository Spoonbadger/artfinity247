// Shared labels for art reports and DMCA notices (public form, API, admin queue).
export const REPORT_REASONS = ["copyright", "ai", "offensive", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
// "counter" is a DMCA counter-notice from the artist, filed via /report?type=counter.
export type AnyReason = ReportReason | "counter";

export const REASON_LABEL: Record<ReportReason, string> = {
  copyright: "It’s my work / copied",
  ai: "Made with AI but sold as hand-made",
  offensive: "Offensive or harmful",
  other: "Something else",
};

// Short form used in admin chips and emails.
export const REASON_SHORT: Record<AnyReason, string> = {
  copyright: "Copyright (DMCA)",
  ai: "AI sold as hand-made",
  offensive: "Offensive or harmful",
  other: "Other",
  counter: "Counter-notice",
};

export const isReason = (v: unknown): v is ReportReason => REPORT_REASONS.includes(v as ReportReason);

// Exact statement text, shown on the form and stored with each signed notice.
export const DMCA_STATEMENTS = {
  goodFaith: "I have a good-faith belief this use is not authorized by the copyright owner, its agent, or the law.",
  perjury: "Under penalty of perjury, the information in this notice is accurate and I am the owner or authorized to act for them.",
  mistake: "Under penalty of perjury, I have a good-faith belief the work was removed by mistake or misidentification.",
  jurisdiction:
    "I consent to the jurisdiction of the federal district court for my address (or, if I’m outside the US, any district where Artfinity may be found), and I will accept service of process from the person who filed the notice or their agent.",
  accurate: "The information in this report is accurate.",
} as const;

export type DmcaNotice = {
  kind: "dmca-notice";
  original: string;
  infringingUrl: string;
  address: string;
  phone: string;
  notes: string;
  statements: string[];
  signature: string;
  signedAt: string;
};
export type DmcaCounter = {
  kind: "dmca-counter";
  removedWork: string;
  removedUrl: string;
  address: string;
  phone: string;
  statements: string[];
  signature: string;
  signedAt: string;
};

/** Notices are stored as JSON in ArtReport.details; plain reports are just text. */
export function parseDetails(details: string): DmcaNotice | DmcaCounter | null {
  if (!details.startsWith("{")) return null;
  try {
    const d = JSON.parse(details);
    return d?.kind === "dmca-notice" || d?.kind === "dmca-counter" ? d : null;
  } catch {
    return null;
  }
}

/** Counter-noticed work goes back up 10 to 14 business days after receipt (17 U.S.C. 512(g)). */
export function earliestRestore(received: Date, days = 10) {
  const d = new Date(received);
  let n = 0;
  while (n < days) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) n++;
  }
  return d;
}

export { SITE_URL } from "@/lib/urls";
