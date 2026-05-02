import { Router, type IRouter } from "express";
import { listActiveSymbols } from "../db/symbolRepo.js";
import { getActiveSymbols } from "../services/quoteService.js";
import { getRequestCounts, startedAt } from "../lib/requestCounter.js";

const router: IRouter = Router();

router.get("/status", async (_req, res) => {
  const [dbSymbols] = await Promise.all([listActiveSymbols()]);
  res.set("Cache-Control", "public, max-age=5, stale-while-revalidate=5");
  res.json({
    status: "ok",
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    symbolCount: dbSymbols.length,
    connectedSymbolCount: getActiveSymbols().length,
    requestCounts: getRequestCounts(),
  });
});

export default router;
