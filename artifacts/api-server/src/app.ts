import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes/index.js";
import healthRouter from "./routes/health.js";
import statusRouter from "./routes/status.js";
import { requireInternalToken } from "./middlewares/requireInternalToken.js";
import { increment } from "./lib/requestCounter.js";
import { logger } from "./lib/logger.js";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req: Request, _res: Response, next: NextFunction) => {
  increment(req.method, req.path);
  next();
});

app.use("/api", healthRouter);
app.use("/api", statusRouter);

app.use("/api", requireInternalToken, router);

export default app;
