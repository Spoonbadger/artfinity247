import type { HelpSection } from "./types";

export const HELP_SECTIONS: HelpSection[] = [
  { id: "getting-started", title: "Getting started", blurb: "Your page, your first upload, your first code on a wall.", audience: "artist", dab: "var(--af-scan)" },
  { id: "qr-codes", title: "QR codes", blurb: "Looks, short links, scans, discounts and print sheets.", audience: "artist", dab: "var(--af-sticker)" },
  { id: "selling", title: "Selling & pricing", blurb: "Prices, what you earn, editions, collections, bulk prints.", audience: "artist", dab: "var(--af-coral)" },
  { id: "getting-paid", title: "Getting paid", blurb: "When payouts go out, how they reach you, and taxes.", audience: "artist", dab: "var(--af-earned)" },
  { id: "growing", title: "Growing", blurb: "Share kit, followers, analytics, reviews, referrals, Infinity.", audience: "artist", dab: "#f5b3c8" },
  { id: "trust", title: "Trust & rights", blurb: "Your copyright, AI, stolen art, badges and medals.", audience: "both", dab: "#7b2d8e" },
  { id: "buyers", title: "Buying a print", blurb: "Shipping, tax, paper, frames, damaged prints, your order.", audience: "buyer", dab: "#5bc0be" },
  { id: "account", title: "Your account", blurb: "Logging in, passwords, email, your payout bank, closing your account.", audience: "both", dab: "#c98a5a" },
];

export const sectionById = (id: string) => HELP_SECTIONS.find((s) => s.id === id);
