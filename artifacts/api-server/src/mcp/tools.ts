import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";
import { runScoring } from "../services/universeService.js";
import { getMetrics } from "../services/metricsService.js";
import { getCandles, isValidTimeframe } from "../services/candleService.js";
import { insertSymbol, markSymbolInactive, listActiveSymbols } from "../db/symbolRepo.js";
import { subscribeQuotes, unsubscribeQuotes } from "../services/quoteService.js";

export function registerMcpTools(server: McpServer): void {
  server.tool(
    "scan_universe",
    "Trigger a fresh scoring pass and return the top ranked symbols",
    {},
    async () => {
      const scores = await runScoring();
      return {
        content: [{ type: "text", text: JSON.stringify(scores, null, 2) }],
      };
    },
  );

  server.tool(
    "get_universe",
    "Return the current active symbol list with scores",
    {},
    async () => {
      const symbols = await listActiveSymbols();
      return {
        content: [{ type: "text", text: JSON.stringify(symbols, null, 2) }],
      };
    },
  );

  server.tool(
    "get_metrics",
    "Get IV rank, IVx, and earnings date for a symbol",
    { symbol: z.string().describe("Ticker symbol e.g. AAPL") },
    async ({ symbol }: { symbol: string }) => {
      const metrics = await getMetrics(symbol.toUpperCase());
      return {
        content: [{ type: "text", text: JSON.stringify(metrics, null, 2) }],
      };
    },
  );

  server.tool(
    "get_candles",
    "Get OHLCV candle data for a symbol and timeframe",
    {
      symbol: z.string().describe("Ticker symbol e.g. AAPL"),
      timeframe: z
        .enum(["1d", "60m", "15m"])
        .describe("Candle timeframe: 1d, 60m, or 15m"),
    },
    async ({ symbol, timeframe }: { symbol: string; timeframe: string }) => {
      if (!isValidTimeframe(timeframe)) {
        return {
          content: [
            {
              type: "text",
              text: "Invalid timeframe. Must be one of: 1d, 60m, 15m",
            },
          ],
          isError: true,
        };
      }
      const candles = await getCandles(symbol.toUpperCase(), timeframe);
      return {
        content: [{ type: "text", text: JSON.stringify(candles, null, 2) }],
      };
    },
  );

  server.tool(
    "add_symbol",
    "Add a symbol to the active universe",
    { symbol: z.string().describe("Ticker symbol e.g. AAPL") },
    async ({ symbol }: { symbol: string }) => {
      const upper = symbol.toUpperCase();
      const row = await insertSymbol(upper);
      await subscribeQuotes(upper);
      return {
        content: [{ type: "text", text: JSON.stringify(row, null, 2) }],
      };
    },
  );

  server.tool(
    "remove_symbol",
    "Remove a symbol from the active universe",
    { symbol: z.string().describe("Ticker symbol e.g. AAPL") },
    async ({ symbol }: { symbol: string }) => {
      const upper = symbol.toUpperCase();
      await markSymbolInactive(upper);
      unsubscribeQuotes(upper);
      return {
        content: [{ type: "text", text: `${upper} removed from universe` }],
      };
    },
  );
}
