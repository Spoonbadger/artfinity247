// The dev-only mock import source (ALLOW_MOCK_IMPORT=1, never in production): what the mock picker "picks".
// Links point back at this dev server (GET /api/uploads/import/sample/<name>), so a whole import runs end to end
// through POST /api/uploads/import exactly like a Dropbox one, without any Google or Dropbox account.
// Paintings are generated fresh each time (unique, so they don't trip the duplicate check) at 2700 x 3600 px, big
// enough for every print size. With problems=1 the list also holds one file that fails in each way the artist can meet.

const TITLES = [
  "Canal Street Rain", "Coney Island Wheel", "High Line Dusk", "Red Hook Pier", "Astoria Rooftops", "Washington Square Snow",
  "Bushwick Mural Study", "Hudson Yards Fog", "Prospect Park Pond", "Chinatown Lanterns", "Rockaway Morning", "Harlem Brownstones",
];

export type MockFile = { link: string; name: string; bytes?: number };

const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function mockSamples(origin: string, count: number, problems: boolean): MockFile[] {
  const base = `${origin}/api/uploads/import/sample`;
  const start = Math.floor(Math.random() * TITLES.length);
  const files: MockFile[] = Array.from({ length: count }, (_, k) => {
    const title = TITLES[(start + k) % TITLES.length];
    const seed = Math.floor(Math.random() * 1e9).toString(36);
    return { link: `${base}/painting-${seed}.jpg`, name: `${slug(title)}.jpg` };
  });
  if (problems) {
    files.push(
      { link: `${base}/expired.jpg`, name: "expired-link.jpg" }, // 410, like a Dropbox link past its 4 hours
      { link: `${base}/scan.gif`, name: "old-scan.gif" }, // a type we don't print
      { link: `${base}/small-${Math.floor(Math.random() * 1e9).toString(36)}.jpg`, name: "instagram-copy.jpg" }, // too small to print
      { link: `${origin}/seed/art-01.jpg`, name: "east-river-again.jpg" }, // the demo artist Maya already has this one
    );
  }
  return files;
}
