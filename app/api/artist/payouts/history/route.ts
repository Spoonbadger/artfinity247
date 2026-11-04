// Alias: the dashboard payouts page fetches /api/artist/payouts/history,
// the original route lives at /api/artist/history. Both paths work.
export { GET } from "@/app/api/artist/history/route"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
