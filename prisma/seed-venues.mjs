// Demo partner venues (lib/venues.ts), linked to the codes prisma/seed-scans.mjs made. Called from prisma/seed.mjs
// after seedScans. Codes are matched by their free-text venue; Smorgasburg and "Studio door" stay unlinked so
// /admin/venues has names to merge. Every share starts at 0 (the owner hasn't picked a percentage yet).
// Kalimera Coffee, Ludlow Room and Lumen Café are made up; their addresses are placeholders on real streets.

const VENUES = [
  { name: "Lumen Café", slug: "lumen-cafe", neighborhood: "Williamsburg", address: "214 Bedford Ave, Brooklyn, NY 11249", contactName: "Dana Reyes", contactEmail: "dana@lumencafe.example.com", notes: "Long wall by the window holds 4 to 5 pieces. Busiest on weekend mornings." },
  { name: "Brooklyn Flea", slug: "brooklyn-flea", neighborhood: "DUMBO", address: "80 Pearl St, Brooklyn, NY 11201", contactName: "Market office", contactEmail: "vendors@brooklynflea.example.com", notes: "Saturdays under the Manhattan Bridge archway. Artists hang tags on their own booths." },
  { name: "Industry City", slug: "industry-city", neighborhood: "Sunset Park", address: "220 36th St, Brooklyn, NY 11232", contactName: "Events team", contactEmail: "events@industrycity.example.com", notes: "Weekend makers market in Building 2." },
  { name: "Kalimera Coffee", slug: "kalimera-coffee", neighborhood: "Astoria", address: "31-12 Ditmars Blvd, Astoria, NY 11105", contactName: "Eleni Pappas", contactEmail: "eleni@kalimera.example.com", notes: "Owner rotates art every two months. Prefers email." },
  { name: "Ludlow Room", slug: "ludlow-room", neighborhood: "Lower East Side", address: "142 Ludlow St, New York, NY 10002", contactName: "Marcus Lee", contactEmail: "marcus@ludlowroom.example.com", notes: "Bar, opens at 5pm. Pieces hang along the back booth wall." },
];

const key = (s) => (s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").trim().toLowerCase().replace(/\s+/g, " ");

export async function seedVenues(prisma) {
  // Codes keep their venue text; venueId is cleared by the FK (onDelete: SetNull).
  await prisma.venue.deleteMany();
  const codes = await prisma.qrCode.findMany({ where: { venue: { not: null } }, select: { id: true, venue: true } });
  let linked = 0;
  for (const v of VENUES) {
    const row = await prisma.venue.create({ data: { ...v, sharePct: 0, active: true, createdAt: new Date(Date.now() - 70 * 86400000) } });
    const ids = codes.filter((c) => key(c.venue) === key(v.name)).map((c) => c.id);
    if (ids.length) linked += (await prisma.qrCode.updateMany({ where: { id: { in: ids } }, data: { venueId: row.id, venue: v.name } })).count;
  }
  console.log(`Seeded ${VENUES.length} partner venues, ${linked} codes linked.`);
}

// `node --env-file=.env prisma/seed-venues.mjs` re-seeds just the venues on top of existing demo data.
if (import.meta.url === `file://${process.argv[1]}`) {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  await seedVenues(prisma).finally(() => prisma.$disconnect());
}
