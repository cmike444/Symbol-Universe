import { MarketDataSubscriptionType } from "@tastytrade/api";
import { getTastytradeClient, getCachedClient } from "./tastytradeClient.js";
import { broadcastEvent } from "../websocket/server.js";
import { logger } from "../lib/logger.js";

const activeSymbols = new Set<string>();
const listenerRemovers = new Map<string, () => void>();

interface DxLinkQuoteEvent {
  eventType?: string;
  eventSymbol?: string;
  askPrice?: number;
  bidPrice?: number;
  price?: number;
  lastPrice?: number;
  lastTime?: number;
  time?: number;
}

export async function subscribeQuotes(symbol: string): Promise<void> {
  if (activeSymbols.has(symbol)) return;

  const client = await getTastytradeClient();
  activeSymbols.add(symbol);

  const removeListener = client.quoteStreamer.addEventListener(
    (events: unknown[]) => {
      for (const event of events) {
        const e = event as DxLinkQuoteEvent;
        if (
          e.eventType !== "Quote" ||
          e.eventSymbol?.toUpperCase() !== symbol.toUpperCase()
        )
          continue;

        const bid = e.bidPrice ?? 0;
        const ask = e.askPrice ?? 0;
        const price = e.price ?? e.lastPrice ?? (bid + ask) / 2;
        const timestamp = e.time ?? e.lastTime ?? Date.now();

        broadcastEvent({ type: "price", symbol, price, bid, ask, timestamp });
      }
    },
  );

  listenerRemovers.set(symbol, removeListener);

  client.quoteStreamer.subscribe([symbol], [MarketDataSubscriptionType.Quote]);
  logger.info({ symbol }, "Quote subscription opened");
}

export function unsubscribeQuotes(symbol: string): void {
  if (!activeSymbols.has(symbol)) return;
  activeSymbols.delete(symbol);

  const removeListener = listenerRemovers.get(symbol);
  if (removeListener) {
    removeListener();
    listenerRemovers.delete(symbol);
  }

  const client = getCachedClient();
  if (client) {
    client.quoteStreamer.unsubscribe([symbol]);
    logger.info({ symbol }, "Quote subscription closed");
  }
}

export function getActiveSymbols(): string[] {
  return [...activeSymbols];
}
