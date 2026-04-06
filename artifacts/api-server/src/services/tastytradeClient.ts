import { WebSocket } from "ws";
import TastytradeClient from "@tastytrade/api";
import { logger } from "../lib/logger.js";

(global as unknown as Record<string, unknown>)["WebSocket"] = WebSocket;
(global as unknown as Record<string, unknown>)["window"] = {
  WebSocket,
  setTimeout,
  clearTimeout,
};

let _client: TastytradeClient | null = null;
let _initPromise: Promise<TastytradeClient> | null = null;

export async function getTastytradeClient(): Promise<TastytradeClient> {
  if (_client) return _client;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    const clientSecret = process.env["TASTYTRADE_CLIENT_SECRET"];
    const refreshToken = process.env["TASTYTRADE_REFRESH_TOKEN"];
    const scopesRaw = process.env["TASTYTRADE_OAUTH_SCOPES"] ?? "read trade";

    if (!clientSecret || !refreshToken) {
      throw new Error(
        "TASTYTRADE_CLIENT_SECRET and TASTYTRADE_REFRESH_TOKEN must be set",
      );
    }

    const oauthScopes = scopesRaw.split(/[\s,]+/).filter(Boolean);
    const useSandbox = process.env["TASTYTRADE_SANDBOX"] === "true";
    const baseConfig = useSandbox
      ? TastytradeClient.SandboxConfig
      : TastytradeClient.ProdConfig;

    const client = new TastytradeClient({
      ...baseConfig,
      clientSecret,
      refreshToken,
      oauthScopes,
    } as ConstructorParameters<typeof TastytradeClient>[0]);

    await client.quoteStreamer.connect();
    logger.info("DXLink QuoteStreamer connected");

    _client = client;
    return client;
  })();

  return _initPromise;
}

export function getCachedClient(): TastytradeClient | null {
  return _client;
}
