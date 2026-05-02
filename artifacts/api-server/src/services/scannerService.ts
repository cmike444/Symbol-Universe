import { listScanners, getScanner, setLastRunAt, upsertScannerResults } from "../db/scannerRepo.js";
import { listActiveSymbols } from "../db/symbolRepo.js";
import { getMetricsBulkCached } from "./metricsService.js";
import { getCandles, getLastCachedCandle } from "./candleService.js";
import { getCachedQuotePrice } from "./quoteService.js";
import { logger } from "../lib/logger.js";
import type { Scanner, FilterRule, ScannerResultMetrics, Symbol as SymbolRow } from "@workspace/db/schema";

interface SymbolData {
  symbol: string;
  ivRank: number | null;
  ivx: number | null;
  earningsDate: string | null;
  lendability: string | null;
  score: number | null;
  price: number | null;
  volume: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  daysToEarnings: number | null;
  ivPercentile: number | null;
  liquidityRank: number | null;
  beta: number | null;
  marketCap: number | null;
  callVolume: number | null;
  putVolume: number | null;
  callOpenInterest: number | null;
  putOpenInterest: number | null;
  instrumentType: string | null;
}

function parseDaysToEarnings(earningsDate: string | null): number | null {
  if (!earningsDate) return null;
  const target = new Date(earningsDate).getTime();
  if (isNaN(target)) return null;
  const now = Date.now();
  const days = (target - now) / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.ceil(days));
}

const TEXT_METRICS = new Set<FilterRule["metric"]>(["lendability", "instrumentType"]);

function getFieldValue(data: SymbolData, metric: FilterRule["metric"]): number | string | null {
  switch (metric) {
    case "ivRank": return data.ivRank;
    case "ivx": return data.ivx;
    case "score": return data.score;
    case "lendability": return data.lendability;
    case "earningsDate": return data.daysToEarnings;
    case "price": return data.price;
    case "volume": return data.volume;
    case "open": return data.open;
    case "high": return data.high;
    case "low": return data.low;
    case "ivPercentile": return data.ivPercentile;
    case "liquidityRank": return data.liquidityRank;
    case "beta": return data.beta;
    case "marketCap": return data.marketCap;
    case "callVolume": return data.callVolume;
    case "putVolume": return data.putVolume;
    case "callOpenInterest": return data.callOpenInterest;
    case "putOpenInterest": return data.putOpenInterest;
    case "instrumentType": return data.instrumentType;
  }
}

function evaluateRule(data: SymbolData, rule: FilterRule): boolean {
  const rawValue = getFieldValue(data, rule.metric);
  if (rawValue === null || rawValue === undefined) return false;

  if (TEXT_METRICS.has(rule.metric)) {
    const strValue = String(rawValue).toLowerCase();
    const ruleStr = String(rule.value).toLowerCase();
    if (rule.operator === "=") return strValue === ruleStr;
    if (rule.operator === "!=") return strValue !== ruleStr;
    return false;
  }

  const numValue = Number(rawValue);
  const ruleNum = Number(rule.value);

  if (isNaN(numValue) || isNaN(ruleNum)) return false;

  switch (rule.operator) {
    case ">": return numValue > ruleNum;
    case ">=": return numValue >= ruleNum;
    case "<": return numValue < ruleNum;
    case "<=": return numValue <= ruleNum;
    case "=": return numValue === ruleNum;
    case "!=": return numValue !== ruleNum;
    case "between": {
      const v2 = Number(rule.value2);
      if (isNaN(v2)) return false;
      return numValue >= ruleNum && numValue <= v2;
    }
  }
}

function symbolPasses(data: SymbolData, filters: FilterRule[]): boolean {
  return filters.every((rule) => evaluateRule(data, rule));
}

const CANDLE_FETCH_CONCURRENCY = 5;

async function warmCandlesForSymbols(symbols: string[]): Promise<void> {
  if (symbols.length === 0) return;
  logger.info({ count: symbols.length }, "Fetching missing 1d candles for scanner warm-up");

  for (let i = 0; i < symbols.length; i += CANDLE_FETCH_CONCURRENCY) {
    const batch = symbols.slice(i, i + CANDLE_FETCH_CONCURRENCY);
    await Promise.allSettled(
      batch.map((sym) =>
        getCandles(sym, "1d").catch((err) =>
          logger.warn({ err, symbol: sym }, "Failed to fetch 1d candles during scanner warm-up"),
        ),
      ),
    );
  }
}

const timers = new Map<string, ReturnType<typeof setInterval>>();
const running = new Set<string>();

async function runScanner(scanner: Scanner): Promise<void> {
  if (running.has(scanner.id)) {
    logger.warn({ scannerId: scanner.id }, "Scanner already running — skipping tick");
    return;
  }
  running.add(scanner.id);
  logger.info({ scannerId: scanner.id, name: scanner.name }, "Running scanner");

  try {
    const activeSymbols: SymbolRow[] = await listActiveSymbols();
    if (activeSymbols.length === 0) {
      await upsertScannerResults(scanner.id, []);
      await setLastRunAt(scanner.id, Math.floor(Date.now() / 1000));
      return;
    }

    const symbolNames = activeSymbols.map((s) => s.symbol);

    const metricsArr = await getMetricsBulkCached(symbolNames);
    const metricsMap = new Map(metricsArr.map((m) => [m.symbol, m]));
    const symbolScoreMap = new Map(activeSymbols.map((s) => [s.symbol, s.score ?? null]));

    // Identify symbols lacking any OHLCV data in both in-memory cache and DB snapshot,
    // then fetch their 1d candles. The candle service has a 1-hour TTL, so repeat runs are cheap.
    const symbolsMissingCandles = activeSymbols
      .filter((sym) => {
        const inMem = getLastCachedCandle(sym.symbol, "1d");
        if (inMem) return false;
        return (
          sym.lastClose == null ||
          sym.lastVolume == null ||
          sym.lastOpen == null ||
          sym.lastHigh == null ||
          sym.lastLow == null
        );
      })
      .map((sym) => sym.symbol);

    await warmCandlesForSymbols(symbolsMissingCandles);

    const allData: SymbolData[] = activeSymbols.map((sym) => {
      const m = metricsMap.get(sym.symbol);
      const inMemory = getLastCachedCandle(sym.symbol, "1d");

      // Prefer live quote price for freshness, fall back to candle close, then DB snapshot.
      const livePrice = getCachedQuotePrice(sym.symbol);
      const candleClose = inMemory?.close ?? null;
      const price = livePrice ?? candleClose ?? sym.lastClose ?? null;

      // OHLV come from the candle snapshot; DB snapshot is the fallback for server restarts.
      const volume = inMemory?.volume ?? sym.lastVolume ?? null;
      const open = inMemory?.open ?? sym.lastOpen ?? null;
      const high = inMemory?.high ?? sym.lastHigh ?? null;
      const low = inMemory?.low ?? sym.lastLow ?? null;

      return {
        symbol: sym.symbol,
        ivRank: m?.ivRank ?? sym.ivRank ?? null,
        ivx: m?.ivx ?? sym.ivx ?? null,
        earningsDate: m?.earningsDate ?? sym.earningsDate ?? null,
        lendability: m?.lendability ?? null,
        score: symbolScoreMap.get(sym.symbol) ?? null,
        price,
        volume,
        open,
        high,
        low,
        daysToEarnings: parseDaysToEarnings(m?.earningsDate ?? sym.earningsDate ?? null),
        ivPercentile: m?.ivPercentile ?? null,
        liquidityRank: m?.liquidityRank ?? null,
        beta: m?.beta ?? null,
        marketCap: m?.marketCap ?? null,
        callVolume: m?.callVolume ?? null,
        putVolume: m?.putVolume ?? null,
        callOpenInterest: m?.callOpenInterest ?? null,
        putOpenInterest: m?.putOpenInterest ?? null,
        instrumentType: sym.instrumentType ?? null,
      };
    });

    const filters: FilterRule[] = Array.isArray(scanner.filters) ? scanner.filters : [];
    if (filters.length === 0) {
      await upsertScannerResults(scanner.id, []);
      await setLastRunAt(scanner.id, Math.floor(Date.now() / 1000));
      logger.warn({ scannerId: scanner.id }, "Scanner has no filter rules — yielding empty results");
      return;
    }
    const passing = allData.filter((d) => symbolPasses(d, filters));

    const results = passing.map((d) => ({
      symbol: d.symbol,
      metrics: {
        ivRank: d.ivRank,
        ivx: d.ivx,
        score: d.score,
        lendability: d.lendability,
        earningsDate: d.earningsDate,
        price: d.price,
        volume: d.volume,
        open: d.open,
        high: d.high,
        low: d.low,
        ivPercentile: d.ivPercentile,
        liquidityRank: d.liquidityRank,
        beta: d.beta,
        marketCap: d.marketCap,
        callVolume: d.callVolume,
        putVolume: d.putVolume,
        callOpenInterest: d.callOpenInterest,
        putOpenInterest: d.putOpenInterest,
        instrumentType: d.instrumentType,
      } satisfies ScannerResultMetrics,
    }));

    await upsertScannerResults(scanner.id, results);
    await setLastRunAt(scanner.id, Math.floor(Date.now() / 1000));

    logger.info(
      { scannerId: scanner.id, name: scanner.name, resultCount: results.length },
      "Scanner run complete",
    );
  } catch (err) {
    logger.error({ err, scannerId: scanner.id }, "Scanner run failed");
  } finally {
    running.delete(scanner.id);
  }
}

function scheduleScanner(scanner: Scanner): void {
  if (timers.has(scanner.id)) {
    clearInterval(timers.get(scanner.id)!);
    timers.delete(scanner.id);
  }

  if (!scanner.enabled) return;

  const intervalMs = scanner.intervalSeconds * 1000;

  runScanner(scanner).catch((err) =>
    logger.error({ err, scannerId: scanner.id }, "Initial scanner run failed"),
  );

  const handle = setInterval(() => {
    runScanner(scanner).catch((err) =>
      logger.error({ err, scannerId: scanner.id }, "Scheduled scanner run failed"),
    );
  }, intervalMs);

  timers.set(scanner.id, handle);
  logger.info({ scannerId: scanner.id, intervalSeconds: scanner.intervalSeconds }, "Scanner scheduled");
}

export async function startScannerService(): Promise<void> {
  const scanners = await listScanners();
  for (const scanner of scanners) {
    if (scanner.enabled) {
      scheduleScanner(scanner);
    }
  }
  logger.info({ count: scanners.filter((s) => s.enabled).length }, "Scanner service started");
}

export async function onScannerCreated(scannerId: string): Promise<void> {
  const scanner = await getScanner(scannerId);
  if (scanner) scheduleScanner(scanner);
}

export async function onScannerUpdated(scannerId: string): Promise<void> {
  const scanner = await getScanner(scannerId);
  if (scanner) {
    scheduleScanner(scanner);
  } else {
    if (timers.has(scannerId)) {
      clearInterval(timers.get(scannerId)!);
      timers.delete(scannerId);
    }
  }
}

export function onScannerDeleted(scannerId: string): void {
  if (timers.has(scannerId)) {
    clearInterval(timers.get(scannerId)!);
    timers.delete(scannerId);
    logger.info({ scannerId }, "Scanner unscheduled");
  }
}
