import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/reports";

// AI training and AI answer crawlers: blocked from the whole site.
const AI_BOTS = [
  "GPTBot", "ChatGPT-User", "OAI-SearchBot", "CCBot", "Google-Extended", "anthropic-ai", "ClaudeBot", "Claude-Web",
  "PerplexityBot", "Bytespider", "Applebot-Extended", "meta-externalagent", "FacebookBot", "Amazonbot",
  "cohere-ai", "Diffbot", "Omgilibot", "Omgili", "ImagesiftBot", "Timpibot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: AI_BOTS, disallow: "/" },
      { userAgent: "*", allow: "/", disallow: ["/studio", "/admin", "/api", "/cart", "/q/", "/Q/", "/dashboard", "/checkout", "/information", "/thank-you", "/my-purchases", "/my-sales"] },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
