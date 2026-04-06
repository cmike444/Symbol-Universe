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
});

export const metricsCache = pgTable("metrics_cache", {
  symbol: text("symbol").primaryKey(),
  ivRank: real("iv_rank"),
  ivx: real("ivx"),
  earningsDate: text("earnings_date"),
  lendability: text("lendability"),
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
});

export type MarketMetrics = z.infer<typeof marketMetricsSchema>;
