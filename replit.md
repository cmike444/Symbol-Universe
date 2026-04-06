# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Market data**: @tastytrade/api (DXLink WebSocket for quotes and candles)
- **Real-time**: ws (WebSocket server for streaming price/candle events)
- **MCP**: @modelcontextprotocol/sdk (stdio server for AI tool integration)
- **Scheduling**: node-cron (universe scoring cron jobs)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## symbol-universe Architecture

The API server acts as the `symbol-universe` service — the canonical market data layer for the hedge fund infrastructure. It owns the single DXLink WebSocket connection to TastyTrade and serves candles, real-time quotes, and market metrics over REST + WebSocket.

### REST Endpoints (all under /api)
- `GET /healthz` — Health check with active symbol count
- `GET /symbols` — List active symbols with score/iv_rank/last_scored
- `POST /symbols/:symbol` — Add to universe, open DXLink quote subscription
- `DELETE /symbols/:symbol` — Remove from universe, close DXLink subscription
- `GET /candles/:symbol/:timeframe` — OHLCV candles (1d/60m/15m), in-memory cached
- `GET /metrics/:symbol` — IV rank, IVx, earnings date, lendability (5-min TTL, PostgreSQL cached)

### WebSocket
- `ws://<host>/stream` — all symbols
- `ws://<host>/stream/:symbol` — per-symbol room
- Events: `{ type: 'price', symbol, price, bid, ask, timestamp }` and `{ type: 'candle', ... }`

### MCP Tools (stdio)
- `scan_universe` — trigger scoring pass, return ranked symbols
- `get_universe` — current active symbol list with scores
- `get_metrics(symbol)` — IV rank, IVx, earnings date
- `get_candles(symbol, timeframe)` — OHLCV array
- `add_symbol(symbol)` — add to universe
- `remove_symbol(symbol)` — remove from universe

### Key Files
- `artifacts/api-server/src/services/tastytradeClient.ts` — OAuth singleton (only DXLink connection in infra)
- `artifacts/api-server/src/services/quoteService.ts` — persistent QuoteStreamer per symbol
- `artifacts/api-server/src/services/candleService.ts` — in-memory candle cache + DXLink fetch
- `artifacts/api-server/src/services/metricsService.ts` — IV rank cache (PostgreSQL TTL)
- `artifacts/api-server/src/services/universeService.ts` — scoring + node-cron scheduling
- `artifacts/api-server/src/websocket/server.ts` — ws.Server with per-symbol rooms
- `artifacts/api-server/src/mcp/server.ts` — MCP stdio server
- `artifacts/api-server/src/mcp/tools.ts` — MCP tool definitions
- `artifacts/api-server/src/db/symbolRepo.ts` — Drizzle CRUD for symbols table
- `lib/db/src/schema/symbols.ts` — Drizzle schema: symbols + metrics_cache tables

### Environment Variables
See `artifacts/api-server/.env.example` for the full list. Key vars:
- `TASTYTRADE_CLIENT_SECRET`, `TASTYTRADE_REFRESH_TOKEN`, `TASTYTRADE_OAUTH_SCOPES` — OAuth credentials
- `TASTYTRADE_SANDBOX=true` — use cert environment
- `METRICS_CACHE_TTL_SECONDS` — default 300
- `MIN_UNIVERSE_SCORE` — default 0.4
- `UNIVERSE_SCAN_CRON` — default "0 8 * * 1-5"

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
