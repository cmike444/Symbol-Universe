import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { metricsCache } from "@workspace/db/schema";
import type { MarketMetrics } from "@workspace/db/schema";
import { getTastytradeClient } from "./tastytradeClient.js";
import { logger } from "../lib/logger.js";

const TTL_SECONDS =
  parseInt(process.env["METRICS_CACHE_TTL_SECONDS"] ?? "300", 10) || 300;

function extractMetrics(raw: Record<string, unknown>, symbol: string): MarketMetrics {
  return {
    symbol,
    ivRank: typeof raw["iv-rank"] === "string" ? parseFloat(raw["iv-rank"]) : null,
    ivx: typeof raw["implied-volatility-index"] === "string"
      ? parseFloat(raw["implied-volatility-index"])
      : null,
    earningsDate:
      typeof raw["earnings-expected-report-date"] === "string"
        ? raw["earnings-expected-report-date"]
        : null,
    lendability:
      typeof raw["lendability"] === "string" ? raw["lendability"] : null,
  };
}

export async function getMetrics(symbol: string): Promise<MarketMetrics> {
  const now = Math.floor(Date.now() / 1000);

  const [cached] = await db
    .select()
    .from(metricsCache)
    .where(eq(metricsCache.symbol, symbol));

  if (cached && now - cached.cachedAt < TTL_SECONDS) {
    return {
      symbol,
      ivRank: cached.ivRank ?? null,
      ivx: cached.ivx ?? null,
      earningsDate: cached.earningsDate ?? null,
      lendability: cached.lendability ?? null,
    };
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

  await db
    .insert(metricsCache)
    .values({
      symbol,
      ivRank: metrics.ivRank ?? undefined,
      ivx: metrics.ivx ?? undefined,
      earningsDate: metrics.earningsDate ?? undefined,
      lendability: metrics.lendability ?? undefined,
      cachedAt: now,
    })
    .onConflictDoUpdate({
      target: metricsCache.symbol,
      set: {
        ivRank: metrics.ivRank ?? undefined,
        ivx: metrics.ivx ?? undefined,
        earningsDate: metrics.earningsDate ?? undefined,
        lendability: metrics.lendability ?? undefined,
        cachedAt: now,
      },
    });

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

    await db
      .insert(metricsCache)
      .values({
        symbol: sym,
        ivRank: metrics.ivRank ?? undefined,
        ivx: metrics.ivx ?? undefined,
        earningsDate: metrics.earningsDate ?? undefined,
        lendability: metrics.lendability ?? undefined,
        cachedAt: now,
      })
      .onConflictDoUpdate({
        target: metricsCache.symbol,
        set: {
          ivRank: metrics.ivRank ?? undefined,
          ivx: metrics.ivx ?? undefined,
          earningsDate: metrics.earningsDate ?? undefined,
          lendability: metrics.lendability ?? undefined,
          cachedAt: now,
        },
      });
  }

  return results;
}
