// Content labels an artist can put on a piece. Labeled art is blurred for buyers until they opt in.
export const SENSITIVE_LABELS = ["Nudity", "Violence or gore", "Disturbing imagery", "Drug use", "Strong language"] as const;

/** Parse a comma-separated (or array) label list into clean, de-duplicated labels. */
export function parseSensitive(input: unknown): string[] {
  const parts = Array.isArray(input) ? input.map(String) : String(input ?? "").split(",");
  const out: string[] = [];
  for (const raw of parts) {
    const t = raw.trim().slice(0, 40);
    if (!t) continue;
    const known = SENSITIVE_LABELS.find((l) => l.toLowerCase() === t.toLowerCase());
    const label = known || t;
    if (!out.includes(label)) out.push(label);
  }
  return out.slice(0, 8);
}
