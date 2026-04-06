import { schedule } from "node-cron";
import { listActiveSymbols, updateSymbolScore } from "../db/symbolRepo.js";
import { getMetricsBulk } from "./metricsService.js";
import { broadcastEvent } from "../websocket/server.js";
import { logger } from "../lib/logger.js";

const MIN_SCORE = parseFloat(
  process.env["MIN_UNIVERSE_SCORE"] ?? "0.4",
);

const CRON = process.env["UNIVERSE_SCAN_CRON"] ?? "0 8 * * 1-5";

function parseDaysToEarnings(earningsDate: string | null): number {
  if (!earningsDate) return 30;
  const target = new Date(earningsDate).getTime();
  const now = Date.now();
  const days = Math.max(0, (target - now) / (1000 * 60 * 60 * 24));
  return Math.min(days, 30);
}

function computeScore(
  ivRank: number | null,
  daysToEarnings: number,
): number {
  const ivScore = (ivRank ?? 0) / 100;
  const liquidityScore = 0.7;
  const earningsScore = 1 - daysToEarnings / 30;
  return ivScore * 0.5 + liquidityScore * 0.3 + earningsScore * 0.2;
}

export async function runScoring(): Promise<
  Array<{ symbol: string; score: number }>
> {
  const activeSymbols = await listActiveSymbols();
  if (activeSymbols.length === 0) return [];

  const symbolNames = activeSymbols.map((s) => s.symbol);
  const metrics = await getMetricsBulk(symbolNames);

  const metricsMap = new Map(metrics.map((m) => [m.symbol, m]));
  const now = Math.floor(Date.now() / 1000);
  const scored: Array<{ symbol: string; score: number }> = [];

  for (const sym of activeSymbols) {
    const m = metricsMap.get(sym.symbol);
    const daysToEarnings = parseDaysToEarnings(m?.earningsDate ?? null);
    const score = computeScore(m?.ivRank ?? null, daysToEarnings);

    await updateSymbolScore(sym.symbol, {
      ivRank: m?.ivRank ?? undefined,
      ivx: m?.ivx ?? undefined,
      earningsDate: m?.earningsDate ?? undefined,
      score,
      lastScored: now,
    });

    if (score >= MIN_SCORE) {
      scored.push({ symbol: sym.symbol, score });
    } else {
      logger.info(
        { symbol: sym.symbol, score, MIN_SCORE },
        "Symbol dropped below score threshold",
      );
    }
  }

  scored.sort((a, b) => b.score - a.score);

  broadcastEvent({ type: "scoring", scores: scored });

  logger.info({ count: scored.length }, "Universe scoring complete");
  return scored;
}

export function startUniverseScheduler(): void {
  schedule(CRON, async () => {
    logger.info({ cron: CRON }, "Running scheduled universe scan");
    try {
      await runScoring();
    } catch (err) {
      logger.error({ err }, "Universe scan failed");
    }
  });

  logger.info({ cron: CRON }, "Universe scheduler started");
}
