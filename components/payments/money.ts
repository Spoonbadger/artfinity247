// Shared bits for payment screens. Pure: safe on server and client.

/** "$1,234.50" */
export const money = (cents: number) => ((cents || 0) / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

/** Where buyers and artists write about a payment or an order. */
export const SUPPORT_EMAIL = "support@theartfinity.com";

/** mailto: with the order number already in the subject. */
export const supportMailto = (subject: string) => `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
