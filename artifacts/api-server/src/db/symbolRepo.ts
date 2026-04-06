import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { symbolsTable } from "@workspace/db/schema";
import type { Symbol, InsertSymbol } from "@workspace/db/schema";

export async function insertSymbol(symbol: string): Promise<Symbol> {
  const now = Math.floor(Date.now() / 1000);
  const [row] = await db
    .insert(symbolsTable)
    .values({ symbol, addedAt: now, active: 1 })
    .onConflictDoUpdate({
      target: symbolsTable.symbol,
      set: { active: 1, addedAt: now },
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
