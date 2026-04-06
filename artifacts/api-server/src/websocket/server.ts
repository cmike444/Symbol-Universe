import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "node:http";
import type { Server } from "node:http";
import type { StreamEvent } from "./events.js";
import { logger } from "../lib/logger.js";

interface TaggedClient extends WebSocket {
  symbol?: string;
}

let _wss: WebSocketServer | null = null;

export function createWebSocketServer(httpServer: Server): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer });
  _wss = wss;

  wss.on("connection", (ws: TaggedClient, req: IncomingMessage) => {
    const url = req.url ?? "/stream";
    const match = url.match(/^\/stream\/([^/?]+)/);
    ws.symbol = match ? decodeURIComponent(match[1]!) : undefined;
    logger.info({ symbol: ws.symbol ?? "all" }, "WS client connected");

    ws.on("close", () => {
      logger.info({ symbol: ws.symbol ?? "all" }, "WS client disconnected");
    });
  });

  return wss;
}

export function broadcastEvent(event: StreamEvent): void {
  if (!_wss) return;

  const payload = JSON.stringify(event);
  const targetSymbol =
    event.type === "price" || event.type === "candle"
      ? event.symbol
      : undefined;

  for (const client of _wss.clients as Set<TaggedClient>) {
    if (client.readyState !== WebSocket.OPEN) continue;
    if (client.symbol && targetSymbol && client.symbol !== targetSymbol)
      continue;
    client.send(payload);
  }
}

export function getWebSocketServer(): WebSocketServer | null {
  return _wss;
}
