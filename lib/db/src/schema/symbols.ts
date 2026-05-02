import { pgTable, text, real, integer } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const symbolsTable = pgTable("symbols", {
  symbol: text("symbol").primaryKey(),
  addedAt: integer("added_at").notNull(),
  lastScored: integer("last_scored"),
  ivRank: real("iv_rank"),
  ivx: real("ivx"),
  earningsDate: text("earnings_date"),
  score: real("score"),
  active: integer("active").notNull().default(1),
  lastClose: real("last_close"),
  lastOpen: real("last_open"),
  lastHigh: real("last_high"),
  lastLow: real("last_low"),
  lastVolume: real("last_volume"),
  lastCandleAt: integer("last_candle_at"),
  instrumentType: text("instrument_type"),
});

export const metricsCache = pgTable("metrics_cache", {
  symbol: text("symbol").primaryKey(),
  ivRank: real("iv_rank"),
  ivx: real("ivx"),
  earningsDate: text("earnings_date"),
  lendability: text("lendability"),
  ivPercentile: real("iv_percentile"),
  liquidityRank: real("liquidity_rank"),
  beta: real("beta"),
  marketCap: real("market_cap"),
  callVolume: real("call_volume"),
  putVolume: real("put_volume"),
  callOpenInterest: real("call_open_interest"),
  putOpenInterest: real("put_open_interest"),
  cachedAt: integer("cached_at").notNull(),
});

export const insertSymbolSchema = createInsertSchema(symbolsTable);
export const selectSymbolSchema = createSelectSchema(symbolsTable);
export const insertMetricsCacheSchema = createInsertSchema(metricsCache);
export const selectMetricsCacheSchema = createSelectSchema(metricsCache);

export type Symbol = typeof symbolsTable.$inferSelect;
export type InsertSymbol = typeof symbolsTable.$inferInsert;
export type MetricsCache = typeof metricsCache.$inferSelect;
export type InsertMetricsCache = typeof metricsCache.$inferInsert;

export const marketMetricsSchema = z.object({
  symbol: z.string(),
  ivRank: z.number().nullable(),
  ivx: z.number().nullable(),
  earningsDate: z.string().nullable(),
  lendability: z.string().nullable(),
  ivPercentile: z.number().nullable(),
  liquidityRank: z.number().nullable(),
  beta: z.number().nullable(),
  marketCap: z.number().nullable(),
  callVolume: z.number().nullable(),
  putVolume: z.number().nullable(),
  callOpenInterest: z.number().nullable(),
  putOpenInterest: z.number().nullable(),
});

export type MarketMetrics = z.infer<typeof marketMetricsSchema>;
