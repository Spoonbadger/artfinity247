import ThankYouClient from "./ThankYouClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Thank you" };

export default function ThankYouPage({ searchParams }: { searchParams: { session_id?: string } }) {
  return <ThankYouClient sessionId={typeof searchParams.session_id === "string" ? searchParams.session_id : ""} />;
}
