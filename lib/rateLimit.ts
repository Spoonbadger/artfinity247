const RATE_LIMIT = 20 // requests
const WINDOW_MS = 60 * 1000 // 1 minute

const ipMap = new Map<string, { count: number; start: number }>();

export function rateLimit(ip: string) {
  const now = Date.now();
  const entry = ipMap.get(ip);

  if (!entry) {
    ipMap.set(ip, { count: 1, start: now });
    return true;
  }

  if (now - entry.start > WINDOW_MS) {
    ipMap.set(ip, { count: 1, start: now });
    return true;
  }

  if (entry.count >= RATE_LIMIT) {
    return false;
  }

  entry.count++;
  return true;
}
