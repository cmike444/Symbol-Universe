import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import symbolsRouter from "./symbols.js";
import candlesRouter from "./candles.js";
import metricsRouter from "./metrics.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(symbolsRouter);
router.use(candlesRouter);
router.use(metricsRouter);

export default router;
