import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { listActiveSymbols } from "../db/symbolRepo.js";
import { getActiveSymbols } from "../services/quoteService.js";

const router: IRouter = Router();

router.get("/healthz", async (_req, res) => {
  const [dbSymbols] = await Promise.all([listActiveSymbols()]);
  const connectedSymbols = getActiveSymbols();
  const data = HealthCheckResponse.parse({
    status: "ok",
    symbolCount: dbSymbols.length,
    connectedSymbolCount: connectedSymbols.length,
  });
  res.json(data);
});

export default router;
