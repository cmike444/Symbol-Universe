import { Router, type IRouter } from "express";
import {
  insertSymbol,
  markSymbolInactive,
  listActiveSymbols,
  getSymbol,
} from "../db/symbolRepo.js";
import { subscribeQuotes, unsubscribeQuotes } from "../services/quoteService.js";
import { getMetrics } from "../services/metricsService.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

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

    const row = await insertSymbol(upper);

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
