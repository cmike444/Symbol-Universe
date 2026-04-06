const counts: Record<string, number> = {};

const ROUTE_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /^GET \/api\/healthz$/, label: "GET /api/healthz" },
  { pattern: /^GET \/api\/symbols$/, label: "GET /api/symbols" },
  { pattern: /^POST \/api\/symbols\//, label: "POST /api/symbols/:symbol" },
  { pattern: /^DELETE \/api\/symbols\//, label: "DELETE /api/symbols/:symbol" },
  { pattern: /^GET \/api\/candles\//, label: "GET /api/candles/:symbol/:timeframe" },
  { pattern: /^GET \/api\/metrics\//, label: "GET /api/metrics/:symbol" },
];

export function increment(method: string, path: string): void {
  const key = `${method.toUpperCase()} ${path}`;
  for (const { pattern, label } of ROUTE_PATTERNS) {
    if (pattern.test(key)) {
      counts[label] = (counts[label] ?? 0) + 1;
      return;
    }
  }
}

export function getRequestCounts(): Record<string, number> {
  return { ...counts };
}

export const startedAt = Date.now();
