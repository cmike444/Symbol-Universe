import http from "node:http";
import app from "./app.js";
import { logger } from "./lib/logger.js";
import { createWebSocketServer } from "./websocket/server.js";
import { getTastytradeClient } from "./services/tastytradeClient.js";
import { startUniverseScheduler } from "./services/universeService.js";
import { subscribeQuotes } from "./services/quoteService.js";
import { listActiveSymbols } from "./db/symbolRepo.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

if (!process.env["INTERNAL_API_TOKEN"]) {
  logger.warn("INTERNAL_API_TOKEN is not set — all /api endpoints (except /healthz) will return 503");
}

if (!process.env["TASTYTRADE_CLIENT_SECRET"]) {
  logger.warn("TASTYTRADE_CLIENT_SECRET is not set — TastyTrade integration will be unavailable");
}

const httpServer = http.createServer(app);

createWebSocketServer(httpServer);
logger.info("WebSocket server attached");

httpServer.listen(port, async () => {
  logger.info({ port }, "Server listening");

  if (process.env["TASTYTRADE_CLIENT_SECRET"] && process.env["TASTYTRADE_REFRESH_TOKEN"]) {
    try {
      await getTastytradeClient();
      logger.info("TastyTrade client initialized");

      const activeSymbols = await listActiveSymbols();
      for (const sym of activeSymbols) {
        await subscribeQuotes(sym.symbol).catch((err: unknown) =>
          logger.warn({ err, symbol: sym.symbol }, "Failed to re-subscribe quote"),
        );
      }

      if (activeSymbols.length > 0) {
        logger.info(
          { count: activeSymbols.length },
          "Re-subscribed quotes for active symbols",
        );
      }

      startUniverseScheduler();
    } catch (err) {
      logger.error({ err }, "Failed to initialize TastyTrade client — market data unavailable");
    }
  } else {
    logger.warn("Skipping TastyTrade initialization — credentials not set");
    startUniverseScheduler();
  }
});
