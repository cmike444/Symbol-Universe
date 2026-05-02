import { Router, type IRouter } from "express";
import {
  insertSymbol,
  markSymbolInactive,
  listActiveSymbols,
  getSymbol,
} from "../db/symbolRepo.js";
import { subscribeQuotes, unsubscribeQuotes } from "../services/quoteService.js";
import { getMetrics } from "../services/metricsService.js";
import { getTastytradeClient } from "../services/tastytradeClient.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

async function resolveInstrumentType(symbol: string): Promise<string> {
  if (symbol.startsWith("/")) {
    return "Future";
  }
  try {
    const client = await getTastytradeClient();
    const response = await client.instrumentsService.getSingleEquity(symbol);
    const data = response?.data as Record<string, unknown> | undefined;
    if (data) {
      if (data["is-etf"] === true || data["is-etf"] === "true") return "ETF";
      if (data["is-index"] === true || data["is-index"] === "true") return "Index";
      const instrumentType = data["instrument-type"];
      if (typeof instrumentType === "string" && instrumentType) return instrumentType;
    }
  } catch {
    // ignore — not all symbols have equity data (e.g. futures options)
  }
  return "Equity";
}

router.get("/symbols", async (req, res) => {
  try {
    const symbols = await listActiveSymbols();
    res.json(symbols);
  } catch (err) {
    req.log.error({ err }, "Failed to list symbols");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/symbols/:symbol", async (req, res) => {
  const { symbol } = req.params;
  const upper = symbol.toUpperCase();

  try {
    const existing = await getSymbol(upper);
    if (existing?.active === 1) {
      res.status(409).json({ error: "Symbol already active" });
      return;
    }

    const instrumentType = await resolveInstrumentType(upper).catch((err: unknown) => {
      logger.warn({ err, symbol: upper }, "Could not resolve instrument type");
      return "Equity";
    });

    const row = await insertSymbol(upper, instrumentType);

    await Promise.allSettled([
      subscribeQuotes(upper),
      getMetrics(upper).catch((err: unknown) =>
        logger.warn({ err, symbol: upper }, "Could not pre-cache metrics"),
      ),
    ]);

    res.json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to add symbol");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/symbols/:symbol", async (req, res) => {
  const { symbol } = req.params;
  const upper = symbol.toUpperCase();

  try {
    const removed = await markSymbolInactive(upper);
    if (!removed) {
      res.status(404).json({ error: "Symbol not found" });
      return;
    }

    unsubscribeQuotes(upper);
    res.json({ message: `${upper} removed from universe` });
  } catch (err) {
    req.log.error({ err }, "Failed to remove symbol");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
