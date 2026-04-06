import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { listActiveSymbols } from "../db/symbolRepo.js";

const router: IRouter = Router();

router.get("/healthz", async (_req, res) => {
  const symbols = await listActiveSymbols();
  const data = HealthCheckResponse.parse({
    status: "ok",
    symbolCount: symbols.length,
  });
  res.json(data);
});

export default router;
