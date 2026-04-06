import { Router, type IRouter } from "express";
import symbolsRouter from "./symbols.js";
import candlesRouter from "./candles.js";
import metricsRouter from "./metrics.js";

const router: IRouter = Router();

router.use(symbolsRouter);
router.use(candlesRouter);
router.use(metricsRouter);

export default router;
