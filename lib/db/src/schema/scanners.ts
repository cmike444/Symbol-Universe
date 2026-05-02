import { pgTable, text, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const filterRuleSchema = z.object({
  metric: z.enum([
    "ivRank", "ivx", "score", "lendability", "earningsDate",
    "price", "volume", "open", "high", "low",
    "ivPercentile", "liquidityRank", "beta", "marketCap",
    "callVolume", "putVolume", "callOpenInterest", "putOpenInterest",
    "instrumentType",
  ]),
  operator: z.enum([">", ">=", "<", "<=", "=", "!=", "between"]),
  value: z.union([z.number(), z.string()]),
  value2: z.union([z.number(), z.string()]).optional(),
});

export type FilterRule = z.infer<typeof filterRuleSchema>;

export const scannersTable = pgTable("scanners", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  filters: jsonb("filters").notNull().$type<FilterRule[]>(),
  intervalSeconds: integer("interval_seconds").notNull().default(300),
  enabled: integer("enabled").notNull().default(1),
  lastRunAt: integer("last_run_at"),
  createdAt: integer("created_at").notNull(),
});

export const scannerResultsTable = pgTable("scanner_results", {
  scannerId: text("scanner_id").notNull().references(() => scannersTable.id, { onDelete: "cascade" }),
  symbol: text("symbol").notNull(),
  metrics: jsonb("metrics").notNull().$type<ScannerResultMetrics>(),
  updatedAt: integer("updated_at").notNull(),
});

export interface ScannerResultMetrics {
  ivRank: number | null;
  ivx: number | null;
  score: number | null;
  lendability: string | null;
  earningsDate: string | null;
  price: number | null;
  volume: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  ivPercentile: number | null;
  liquidityRank: number | null;
  beta: number | null;
  marketCap: number | null;
  callVolume: number | null;
  putVolume: number | null;
  callOpenInterest: number | null;
  putOpenInterest: number | null;
  instrumentType: string | null;
}

export const insertScannerSchema = createInsertSchema(scannersTable);
export const selectScannerSchema = createSelectSchema(scannersTable);
export const insertScannerResultSchema = createInsertSchema(scannerResultsTable);
export const selectScannerResultSchema = createSelectSchema(scannerResultsTable);

export type Scanner = typeof scannersTable.$inferSelect;
export type InsertScanner = typeof scannersTable.$inferInsert;
export type ScannerResult = typeof scannerResultsTable.$inferSelect;
export type InsertScannerResult = typeof scannerResultsTable.$inferInsert;
