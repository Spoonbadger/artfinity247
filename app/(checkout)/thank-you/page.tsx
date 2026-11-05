import ThankYouClient from "./ThankYouClient";
import { getCollector } from "@/lib/collector";
import { rewardSettings } from "@/lib/collectorRewards";

export const dynamic = "force-dynamic";

export default async function ThankYouPage({ searchParams }: { searchParams: { session_id?: string } }) {
  // The optional collection is offered softly after purchase (never required to buy).
  const [collector, rewards] = await Promise.all([getCollector().catch(() => null), rewardSettings().catch(() => null)]);
  return <ThankYouClient sessionId={typeof searchParams.session_id === "string" ? searchParams.session_id : ""} collector={{ signedIn: !!collector, rewards: !!rewards?.enabled }} />;
}
