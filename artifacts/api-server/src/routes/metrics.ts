import { Router, type IRouter } from "express";
import { getMetrics } from "../services/metricsService.js";

const router: IRouter = Router();

router.get("/metrics/:symbol", async (req, res) => {
  const { symbol } = req.params;

  try {
    const metrics = await getMetrics(symbol.toUpperCase());
    res.json(metrics);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch metrics");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
