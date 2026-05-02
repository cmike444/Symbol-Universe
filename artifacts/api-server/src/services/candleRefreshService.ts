import { listActiveSymbols } from "../db/symbolRepo.js";
import { getCandles } from "./candleService.js";
import { logger } from "../lib/logger.js";

const REFRESH_INTERVAL_MS = 60 * 60 * 1000;

async function refreshDailyCandles(): Promise<void> {
  let symbols: Awaited<ReturnType<typeof listActiveSymbols>>;
  try {
    symbols = await listActiveSymbols();
  } catch (err) {
    logger.error({ err }, "Candle refresh: failed to list active symbols");
    return;
  }

  if (symbols.length === 0) return;

  logger.info({ count: symbols.length }, "Candle refresh: fetching 1d candles for active symbols");

  const results = await Promise.allSettled(
    symbols.map((sym) => getCandles(sym.symbol, "1d")),
  );

  const failed = results.filter((r) => r.status === "rejected").length;
  const succeeded = results.length - failed;

  logger.info(
    { succeeded, failed, total: symbols.length },
    "Candle refresh complete",
  );
}

export async function startCandleRefreshService(): Promise<void> {
  // Await the initial refresh so callers can depend on candle data being present
  // before starting services that read from the DB candle snapshot (e.g. scanner)
  await refreshDailyCandles().catch((err) =>
    logger.error({ err }, "Initial candle refresh failed"),
  );

  setInterval(() => {
    refreshDailyCandles().catch((err) =>
      logger.error({ err }, "Scheduled candle refresh failed"),
    );
  }, REFRESH_INTERVAL_MS);

  logger.info({ intervalMs: REFRESH_INTERVAL_MS }, "Candle refresh service started");
}
