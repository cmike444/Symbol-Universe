import { Router, type IRouter } from "express";
import { getCandles, isValidTimeframe } from "../services/candleService.js";

const router: IRouter = Router();

router.get("/candles/:symbol/:timeframe", async (req, res) => {
  const { symbol, timeframe } = req.params;

  if (!isValidTimeframe(timeframe)) {
    res
      .status(400)
      .json({ error: "Invalid timeframe. Must be one of: 1d, 60m, 15m" });
    return;
  }

  try {
    const candles = await getCandles(symbol.toUpperCase(), timeframe);
    res.json(candles);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch candles");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
