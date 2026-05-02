import { CandleType } from "@tastytrade/api";
import { getTastytradeClient } from "./tastytradeClient.js";
import { broadcastEvent } from "../websocket/server.js";
import { logger } from "../lib/logger.js";
import { updateSymbolCandle } from "../db/symbolRepo.js";

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

type Timeframe = "1d" | "60m" | "15m";

const candleCacheTtlMs =
  parseInt(process.env["CANDLE_CACHE_TTL_MINUTES"] ?? "15", 10) * 60 * 1000;

interface TimeframeConfig {
  candleType: CandleType;
  period: number;
  lookbackMs: number;
  cacheTtlMs: number;
}

const TIMEFRAME_CONFIG: Record<Timeframe, TimeframeConfig> = {
  "1d": {
    candleType: CandleType.Day,
    period: 1,
    lookbackMs: 365 * 24 * 60 * 60 * 1000,
    cacheTtlMs: 60 * 60 * 1000,
  },
  "60m": {
    candleType: CandleType.Minute,
    period: 60,
    lookbackMs: 60 * 24 * 60 * 60 * 1000,
    cacheTtlMs: candleCacheTtlMs,
  },
  "15m": {
    candleType: CandleType.Minute,
    period: 15,
    lookbackMs: 14 * 24 * 60 * 60 * 1000,
    cacheTtlMs: candleCacheTtlMs,
  },
};

const COLLECT_MS = 8000;

interface CacheEntry {
  candles: Candle[];
  cachedAt: number;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(symbol: string, timeframe: Timeframe): string {
  return `${symbol}:${timeframe}`;
}

export function getLastCachedCandle(symbol: string, timeframe: Timeframe = "1d"): Candle | null {
  const key = cacheKey(symbol, timeframe);
  const entry = cache.get(key);
  if (!entry || entry.candles.length === 0) return null;
  return entry.candles[entry.candles.length - 1] ?? null;
}

interface DxCandleEvent {
  eventType?: string;
  eventSymbol?: string;
  time?: number;
  openPrice?: number;
  highPrice?: number;
  lowPrice?: number;
  closePrice?: number;
  volume?: number;
}

export async function getCandles(
  symbol: string,
  timeframe: Timeframe,
): Promise<Candle[]> {
  const config = TIMEFRAME_CONFIG[timeframe];
  const key = cacheKey(symbol, timeframe);
  const now = Date.now();

  const cached = cache.get(key);
  if (cached && now - cached.cachedAt < config.cacheTtlMs) {
    return cached.candles;
  }

  const client = await getTastytradeClient();
  const fromTime = now - config.lookbackMs;

  const candles: Candle[] = [];

  const removeListener = client.quoteStreamer.addEventListener(
    (events: unknown[]) => {
      for (const event of events) {
        const e = event as DxCandleEvent;
        if (e.eventType !== "Candle") continue;
        if (!e.eventSymbol?.startsWith(symbol)) continue;

        const candle: Candle = {
          time: e.time ?? 0,
          open: e.openPrice ?? 0,
          high: e.highPrice ?? 0,
          low: e.lowPrice ?? 0,
          close: e.closePrice ?? 0,
          volume: e.volume ?? 0,
        };

        if (candle.time > 0) {
          candles.push(candle);
          broadcastEvent({ type: "candle", symbol, timeframe, candle });
        }
      }
    },
  );

  client.quoteStreamer.subscribeCandles(
    symbol,
    fromTime,
    config.period,
    config.candleType,
  );

  await new Promise<void>((resolve) => setTimeout(resolve, COLLECT_MS));

  removeListener();

  const sorted = candles
    .filter((c) => c.time > 0)
    .sort((a, b) => a.time - b.time);

  cache.set(key, { candles: sorted, cachedAt: now });
  logger.info({ symbol, timeframe, count: sorted.length }, "Candle fetch complete");

  // Persist the latest daily candle to DB so the scanner can read it without a live API call
  if (timeframe === "1d" && sorted.length > 0) {
    const latest = sorted[sorted.length - 1]!;
    updateSymbolCandle(symbol, latest).catch((err) =>
      logger.warn({ err, symbol }, "Failed to persist latest candle to symbols table"),
    );
  }

  return sorted;
}

export function isValidTimeframe(tf: string): tf is Timeframe {
  return tf === "1d" || tf === "60m" || tf === "15m";
}
