// Shared labels for art reports (public form, API, admin queue).
export const REPORT_REASONS = ["copyright", "ai", "offensive", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REASON_LABEL: Record<ReportReason, string> = {
  copyright: "It’s my work / copied",
  ai: "Made with AI but sold as hand-made",
  offensive: "Offensive or harmful",
  other: "Something else",
};

// Short form used in admin chips and emails.
export const REASON_SHORT: Record<ReportReason, string> = {
  copyright: "Copyright",
  ai: "AI sold as hand-made",
  offensive: "Offensive or harmful",
  other: "Other",
};

export const isReason = (v: unknown): v is ReportReason => REPORT_REASONS.includes(v as ReportReason);

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://theartfinity.com").replace(/\/$/, "");
