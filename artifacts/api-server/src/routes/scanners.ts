import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import { z } from "zod";
import {
  listScanners,
  getScanner,
  createScanner,
  updateScanner,
  deleteScanner,
  getScannerResults,
  getScannerResultCounts,
} from "../db/scannerRepo.js";
import {
  onScannerCreated,
  onScannerUpdated,
  onScannerDeleted,
} from "../services/scannerService.js";

const router: IRouter = Router();

const NUMERIC_METRICS = [
  "ivRank", "ivx", "score", "earningsDate",
  "price", "volume", "open", "high", "low",
  "ivPercentile", "liquidityRank", "beta", "marketCap",
  "callVolume", "putVolume", "callOpenInterest", "putOpenInterest",
] as const;

const TEXT_METRICS = ["lendability", "instrumentType"] as const;

const filterRuleSchema = z.union([
  z.object({
    metric: z.enum(NUMERIC_METRICS),
    operator: z.enum([">", ">=", "<", "<=", "=", "!=", "between"]),
    value: z.number(),
    value2: z.number().optional(),
  }).superRefine((rule, ctx) => {
    if (rule.operator === "between" && rule.value2 === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "value2 is required for 'between' operator" });
    }
  }),
  z.object({
    metric: z.enum(TEXT_METRICS),
    operator: z.enum(["=", "!="]),
    value: z.string(),
    value2: z.undefined(),
  }),
]);

const createScannerSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).nullish(),
  filters: z.array(filterRuleSchema).min(1, "At least one filter rule is required"),
  intervalSeconds: z.number().int().min(60).max(86400).default(300),
  enabled: z.boolean().default(true),
});

const updateScannerSchema = createScannerSchema.partial();

router.get("/scanners", async (req, res) => {
  try {
    res.set("Cache-Control", "public, max-age=10, stale-while-revalidate=10");
    const scanners = await listScanners();
    const ids = scanners.map((s) => s.id);
    const counts = await getScannerResultCounts(ids);

    const result = scanners.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description ?? null,
      intervalSeconds: s.intervalSeconds,
      enabled: s.enabled === 1,
      lastRunAt: s.lastRunAt ?? null,
      resultCount: counts[s.id] ?? 0,
      filterCount: Array.isArray(s.filters) ? s.filters.length : 0,
      createdAt: s.createdAt,
    }));

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to list scanners");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/scanners/:id", async (req, res) => {
  try {
    res.set("Cache-Control", "public, max-age=10, stale-while-revalidate=10");
    const scanner = await getScanner(req.params["id"]!);
    if (!scanner) {
      res.status(404).json({ error: "Scanner not found" });
      return;
    }

    res.json({
      id: scanner.id,
      name: scanner.name,
      description: scanner.description ?? null,
      filters: scanner.filters,
      intervalSeconds: scanner.intervalSeconds,
      enabled: scanner.enabled === 1,
      lastRunAt: scanner.lastRunAt ?? null,
      createdAt: scanner.createdAt,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get scanner");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/scanners", async (req, res) => {
  const parsed = createScannerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const { name, description, filters, intervalSeconds, enabled } = parsed.data;
    const now = Math.floor(Date.now() / 1000);
    const id = randomUUID();

    const scanner = await createScanner({
      id,
      name,
      description: description ?? null,
      filters,
      intervalSeconds: intervalSeconds ?? 300,
      enabled: enabled !== false ? 1 : 0,
      createdAt: now,
    });

    await onScannerCreated(scanner.id);

    res.status(201).json({
      id: scanner.id,
      name: scanner.name,
      description: scanner.description ?? null,
      filters: scanner.filters,
      intervalSeconds: scanner.intervalSeconds,
      enabled: scanner.enabled === 1,
      lastRunAt: scanner.lastRunAt ?? null,
      createdAt: scanner.createdAt,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create scanner");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/scanners/:id", async (req, res) => {
  const parsed = updateScannerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const { name, description, filters, intervalSeconds, enabled } = parsed.data;

    const fields: Record<string, unknown> = {};
    if (name !== undefined) fields["name"] = name;
    if ("description" in parsed.data) fields["description"] = description ?? null;
    if (filters !== undefined) fields["filters"] = filters;
    if (intervalSeconds !== undefined) fields["intervalSeconds"] = intervalSeconds;
    if (enabled !== undefined) fields["enabled"] = enabled ? 1 : 0;

    const scanner = await updateScanner(req.params["id"]!, fields);
    if (!scanner) {
      res.status(404).json({ error: "Scanner not found" });
      return;
    }

    await onScannerUpdated(scanner.id);

    res.json({
      id: scanner.id,
      name: scanner.name,
      description: scanner.description ?? null,
      filters: scanner.filters,
      intervalSeconds: scanner.intervalSeconds,
      enabled: scanner.enabled === 1,
      lastRunAt: scanner.lastRunAt ?? null,
      createdAt: scanner.createdAt,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update scanner");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/scanners/:id", async (req, res) => {
  try {
    const deleted = await deleteScanner(req.params["id"]!);
    if (!deleted) {
      res.status(404).json({ error: "Scanner not found" });
      return;
    }

    onScannerDeleted(req.params["id"]!);
    res.json({ message: "Scanner deleted" });
  } catch (err) {
    req.log.error({ err }, "Failed to delete scanner");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/scanners/:id/results", async (req, res) => {
  try {
    res.set("Cache-Control", "public, max-age=15, stale-while-revalidate=15");
    const scanner = await getScanner(req.params["id"]!);
    if (!scanner) {
      res.status(404).json({ error: "Scanner not found" });
      return;
    }

    const results = await getScannerResults(req.params["id"]!);

    res.json(
      results.map((r) => ({
        symbol: r.symbol,
        ...(r.metrics as object),
        updatedAt: r.updatedAt,
      })),
    );
  } catch (err) {
    req.log.error({ err }, "Failed to get scanner results");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
