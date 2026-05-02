import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { metricsCache } from "@workspace/db/schema";
import type { MarketMetrics } from "@workspace/db/schema";
import { getTastytradeClient } from "./tastytradeClient.js";
import { logger } from "../lib/logger.js";

const TTL_SECONDS =
  parseInt(process.env["METRICS_CACHE_TTL_SECONDS"] ?? "300", 10) || 300;

function parseNum(raw: Record<string, unknown>, key: string): number | null {
  const v = raw[key];
  if (typeof v === "string") { const n = parseFloat(v); return isNaN(n) ? null : n; }
  if (typeof v === "number") return isNaN(v) ? null : v;
  return null;
}

function extractMetrics(raw: Record<string, unknown>, symbol: string): MarketMetrics {
  return {
    symbol,
    ivRank: parseNum(raw, "iv-rank"),
    ivx: parseNum(raw, "implied-volatility-index"),
    earningsDate:
      typeof raw["earnings-expected-report-date"] === "string"
        ? raw["earnings-expected-report-date"]
        : null,
    lendability:
      typeof raw["lendability"] === "string" ? raw["lendability"] : null,
    ivPercentile: parseNum(raw, "implied-volatility-percentile"),
    liquidityRank: parseNum(raw, "liquidity-rank"),
    beta: parseNum(raw, "beta"),
    marketCap: parseNum(raw, "market-cap"),
    callVolume: parseNum(raw, "call-volume"),
    putVolume: parseNum(raw, "put-volume"),
    callOpenInterest: parseNum(raw, "call-open-interest"),
    putOpenInterest: parseNum(raw, "put-open-interest"),
  };
}

function metricsToInsert(m: MarketMetrics, now: number) {
  return {
    symbol: m.symbol,
    ivRank: m.ivRank ?? undefined,
    ivx: m.ivx ?? undefined,
    earningsDate: m.earningsDate ?? undefined,
    lendability: m.lendability ?? undefined,
    ivPercentile: m.ivPercentile ?? undefined,
    liquidityRank: m.liquidityRank ?? undefined,
    beta: m.beta ?? undefined,
    marketCap: m.marketCap ?? undefined,
    callVolume: m.callVolume ?? undefined,
    putVolume: m.putVolume ?? undefined,
    callOpenInterest: m.callOpenInterest ?? undefined,
    putOpenInterest: m.putOpenInterest ?? undefined,
    cachedAt: now,
  };
}

function rowToMetrics(symbol: string, r: typeof metricsCache.$inferSelect): MarketMetrics {
  return {
    symbol,
    ivRank: r.ivRank ?? null,
    ivx: r.ivx ?? null,
    earningsDate: r.earningsDate ?? null,
    lendability: r.lendability ?? null,
    ivPercentile: r.ivPercentile ?? null,
    liquidityRank: r.liquidityRank ?? null,
    beta: r.beta ?? null,
    marketCap: r.marketCap ?? null,
    callVolume: r.callVolume ?? null,
    putVolume: r.putVolume ?? null,
    callOpenInterest: r.callOpenInterest ?? null,
    putOpenInterest: r.putOpenInterest ?? null,
  };
}

export async function getMetrics(symbol: string): Promise<MarketMetrics> {
  const now = Math.floor(Date.now() / 1000);

  const [cached] = await db
    .select()
    .from(metricsCache)
    .where(eq(metricsCache.symbol, symbol));

  if (cached && now - cached.cachedAt < TTL_SECONDS) {
    return rowToMetrics(symbol, cached);
  }

  const client = await getTastytradeClient();
  const response = await client.marketMetricsService.getMarketMetrics({
    symbols: symbol,
  });

  const items: Record<string, unknown>[] =
    Array.isArray(response?.data?.items) ? response.data.items : [];

  const raw = items.find(
    (i) => (i["symbol"] as string)?.toUpperCase() === symbol.toUpperCase(),
  ) ?? {};

  const metrics = extractMetrics(raw, symbol);
  const insert = metricsToInsert(metrics, now);

  await db
    .insert(metricsCache)
    .values(insert)
    .onConflictDoUpdate({ target: metricsCache.symbol, set: insert });

  logger.info({ symbol, metrics }, "Fetched and cached market metrics");
  return metrics;
}

export async function getMetricsBulk(
  symbols: string[],
): Promise<MarketMetrics[]> {
  if (symbols.length === 0) return [];

  const client = await getTastytradeClient();
  const response = await client.marketMetricsService.getMarketMetrics({
    symbols: symbols.join(","),
  });

  const items: Record<string, unknown>[] =
    Array.isArray(response?.data?.items) ? response.data.items : [];

  const now = Math.floor(Date.now() / 1000);
  const results: MarketMetrics[] = [];

  for (const raw of items) {
    const sym = (raw["symbol"] as string) ?? "";
    if (!sym) continue;
    const metrics = extractMetrics(raw, sym);
    results.push(metrics);

    const insert = metricsToInsert(metrics, now);
    await db
      .insert(metricsCache)
      .values(insert)
      .onConflictDoUpdate({ target: metricsCache.symbol, set: insert });
  }

  return results;
}

/**
 * Read metrics for a set of symbols from the DB cache only — no live API calls.
 * Symbols absent from the cache return null for all metric fields.
 */
export async function getMetricsBulkCached(
  symbols: string[],
): Promise<MarketMetrics[]> {
  if (symbols.length === 0) return [];

  const rows = await db.select().from(metricsCache);
  const rowMap = new Map(rows.map((r) => [r.symbol, r]));

  return symbols.map((sym) => {
    const r = rowMap.get(sym);
    if (!r) {
      return {
        symbol: sym,
        ivRank: null, ivx: null, earningsDate: null, lendability: null,
        ivPercentile: null, liquidityRank: null, beta: null, marketCap: null,
        callVolume: null, putVolume: null, callOpenInterest: null, putOpenInterest: null,
      };
    }
    return rowToMetrics(sym, r);
  });
}
