import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { symbolsTable } from "@workspace/db/schema";
import type { Symbol, InsertSymbol } from "@workspace/db/schema";

export async function insertSymbol(symbol: string, instrumentType?: string): Promise<Symbol> {
  const now = Math.floor(Date.now() / 1000);
  const [row] = await db
    .insert(symbolsTable)
    .values({ symbol, addedAt: now, active: 1, instrumentType: instrumentType ?? null })
    .onConflictDoUpdate({
      target: symbolsTable.symbol,
      set: { active: 1, addedAt: now, ...(instrumentType ? { instrumentType } : {}) },
    })
    .returning();
  return row!;
}

export async function markSymbolInactive(symbol: string): Promise<boolean> {
  const result = await db
    .update(symbolsTable)
    .set({ active: 0 })
    .where(eq(symbolsTable.symbol, symbol))
    .returning();
  return result.length > 0;
}

export async function listActiveSymbols(): Promise<Symbol[]> {
  return db
    .select()
    .from(symbolsTable)
    .where(eq(symbolsTable.active, 1));
}

export async function getSymbol(symbol: string): Promise<Symbol | undefined> {
  const [row] = await db
    .select()
    .from(symbolsTable)
    .where(eq(symbolsTable.symbol, symbol));
  return row;
}

export async function updateSymbolScore(
  symbol: string,
  fields: Partial<Pick<InsertSymbol, "ivRank" | "ivx" | "earningsDate" | "score" | "lastScored">>,
): Promise<void> {
  await db
    .update(symbolsTable)
    .set(fields)
    .where(eq(symbolsTable.symbol, symbol));
}

export async function updateSymbolCandle(
  symbol: string,
  candle: { open: number; high: number; low: number; close: number; volume: number; time: number },
): Promise<void> {
  await db
    .update(symbolsTable)
    .set({
      lastOpen: candle.open,
      lastHigh: candle.high,
      lastLow: candle.low,
      lastClose: candle.close,
      lastVolume: candle.volume,
      lastCandleAt: Math.floor(candle.time / 1000),
    })
    .where(eq(symbolsTable.symbol, symbol));
}
