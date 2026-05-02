import { eq, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import { scannersTable, scannerResultsTable } from "@workspace/db/schema";
import type { Scanner, InsertScanner, ScannerResult, ScannerResultMetrics } from "@workspace/db/schema";

export async function listScanners(): Promise<Scanner[]> {
  return db.select().from(scannersTable);
}

export async function getScanner(id: string): Promise<Scanner | undefined> {
  const [row] = await db.select().from(scannersTable).where(eq(scannersTable.id, id));
  return row;
}

export async function createScanner(scanner: InsertScanner): Promise<Scanner> {
  const [row] = await db.insert(scannersTable).values(scanner).returning();
  return row!;
}

export async function updateScanner(
  id: string,
  fields: Partial<Omit<InsertScanner, "id" | "createdAt">>,
): Promise<Scanner | undefined> {
  const [row] = await db
    .update(scannersTable)
    .set(fields)
    .where(eq(scannersTable.id, id))
    .returning();
  return row;
}

export async function deleteScanner(id: string): Promise<boolean> {
  const result = await db
    .delete(scannersTable)
    .where(eq(scannersTable.id, id))
    .returning();
  return result.length > 0;
}

export async function setLastRunAt(id: string, ts: number): Promise<void> {
  await db.update(scannersTable).set({ lastRunAt: ts }).where(eq(scannersTable.id, id));
}

export async function upsertScannerResults(
  scannerId: string,
  results: Array<{ symbol: string; metrics: ScannerResultMetrics }>,
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);

  await db.transaction(async (tx) => {
    await tx.delete(scannerResultsTable).where(eq(scannerResultsTable.scannerId, scannerId));

    if (results.length > 0) {
      await tx.insert(scannerResultsTable).values(
        results.map((r) => ({
          scannerId,
          symbol: r.symbol,
          metrics: r.metrics,
          updatedAt: now,
        })),
      );
    }
  });
}

export async function getScannerResults(scannerId: string): Promise<ScannerResult[]> {
  return db
    .select()
    .from(scannerResultsTable)
    .where(eq(scannerResultsTable.scannerId, scannerId));
}

export async function getScannerResultCounts(
  scannerIds: string[],
): Promise<Record<string, number>> {
  if (scannerIds.length === 0) return {};

  const rows = await db
    .select()
    .from(scannerResultsTable)
    .where(inArray(scannerResultsTable.scannerId, scannerIds));

  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.scannerId] = (counts[row.scannerId] ?? 0) + 1;
  }
  return counts;
}
