import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListScanners,
  useCreateScanner,
  useUpdateScanner,
  useDeleteScanner,
  useGetScanner,
  useGetScannerResults,
  getListScannersQueryKey,
  getGetScannerQueryKey,
  getGetScannerResultsQueryKey,
} from "@workspace/api-client-react";
import type {
  ScannerSummary,
  ScannerDetail,
  FilterRule,
  CreateScannerRequest,
  UpdateScannerRequest,
} from "@workspace/api-client-react";

const METRICS = [
  { group: "Volatility", value: "ivRank", label: "IV Rank" },
  { group: "Volatility", value: "ivx", label: "IVx" },
  { group: "Volatility", value: "ivPercentile", label: "IV Percentile" },
  { group: "Score", value: "score", label: "Score" },
  { group: "Score", value: "liquidityRank", label: "Liquidity Rank" },
  { group: "Score", value: "beta", label: "Beta" },
  { group: "Earnings", value: "earningsDate", label: "Days to Earnings" },
  { group: "Price", value: "price", label: "Price (Close)" },
  { group: "Price", value: "open", label: "Open" },
  { group: "Price", value: "high", label: "High" },
  { group: "Price", value: "low", label: "Low" },
  { group: "Volume & OI", value: "volume", label: "Volume" },
  { group: "Volume & OI", value: "callVolume", label: "Call Volume" },
  { group: "Volume & OI", value: "putVolume", label: "Put Volume" },
  { group: "Volume & OI", value: "callOpenInterest", label: "Call Open Interest" },
  { group: "Volume & OI", value: "putOpenInterest", label: "Put Open Interest" },
  { group: "Company", value: "marketCap", label: "Market Cap" },
  { group: "Instrument", value: "lendability", label: "Lendability" },
  { group: "Instrument", value: "instrumentType", label: "Instrument Type" },
] as const;

const NUMERIC_OPERATORS = [">", ">=", "<", "<=", "=", "!=", "between"] as const;
const TEXT_OPERATORS = ["=", "!="] as const;
const TEXT_METRICS = new Set(["lendability", "instrumentType"]);

const INSTRUMENT_TYPE_OPTIONS = ["Equity", "ETF", "Index", "Future", "FutureOption"];
const LENDABILITY_OPTIONS = ["Easy To Borrow", "Locate Required", "Preborrow"];

const INTERVALS = [
  { label: "1 minute", value: 60 },
  { label: "5 minutes", value: 300 },
  { label: "15 minutes", value: 900 },
  { label: "30 minutes", value: 1800 },
  { label: "1 hour", value: 3600 },
  { label: "4 hours", value: 14400 },
  { label: "1 day", value: 86400 },
  { label: "Custom…", value: -1 },
];

const s = {
  page: { padding: "0" } as React.CSSProperties,
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 } as React.CSSProperties,
  title: { fontSize: 20, fontWeight: 700, color: "#e2e8f0", letterSpacing: "-0.01em", margin: 0 } as React.CSSProperties,
  btn: (variant: "primary" | "ghost" | "danger" = "primary"): React.CSSProperties => ({
    padding: "8px 16px",
    borderRadius: 8,
    border: "1px solid",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    background: variant === "primary" ? "#3b82f6" : variant === "danger" ? "transparent" : "transparent",
    color: variant === "danger" ? "#f87171" : variant === "primary" ? "#fff" : "#94a3b8",
    borderColor: variant === "primary" ? "#2563eb" : variant === "danger" ? "#f87171" : "#1e293b",
  }),
  table: { width: "100%", borderCollapse: "collapse" as const },
  th: { textAlign: "left" as const, padding: "10px 14px", fontSize: 11, fontWeight: 600, color: "#475569", textTransform: "uppercase" as const, letterSpacing: "0.08em", borderBottom: "1px solid #1a1a28" },
  td: { padding: "12px 14px", fontSize: 13, color: "#b0b0c8", borderBottom: "1px solid #0e0e16" },
  card: { background: "#0e0e16", border: "1px solid #1a1a28", borderRadius: 12, padding: "20px 24px", marginBottom: 16 },
  overlay: { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" },
  modal: { background: "#0f0f1a", border: "1px solid #1e293b", borderRadius: 14, padding: 28, width: "min(700px, 95vw)", maxHeight: "90vh", overflowY: "auto" as const, zIndex: 101 },
  label: { fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase" as const, letterSpacing: "0.06em", display: "block", marginBottom: 6 },
  input: { background: "#070711", border: "1px solid #1e293b", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#e2e8f0", outline: "none", width: "100%", boxSizing: "border-box" as const },
  select: { background: "#070711", border: "1px solid #1e293b", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#e2e8f0", outline: "none" },
  formGroup: { marginBottom: 18 } as React.CSSProperties,
  row: { display: "flex", gap: 8, alignItems: "center" } as React.CSSProperties,
  badge: (enabled: boolean): React.CSSProperties => ({
    display: "inline-block", padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600,
    background: enabled ? "rgba(74,222,128,0.1)" : "rgba(100,116,139,0.15)",
    color: enabled ? "#4ade80" : "#64748b",
    border: `1px solid ${enabled ? "rgba(74,222,128,0.2)" : "rgba(100,116,139,0.2)"}`,
  }),
  sectionLabel: { fontSize: 11, fontWeight: 600, color: "#334155", letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 10, marginTop: 8 },
};

function formatInterval(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${seconds / 60}m`;
  if (seconds < 86400) return `${seconds / 3600}h`;
  return `${seconds / 86400}d`;
}

function formatTs(ts: number | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleString();
}

type AllMetric = typeof METRICS[number]["value"];
type AllOperator = typeof NUMERIC_OPERATORS[number];

interface FilterDraft {
  metric?: AllMetric;
  operator?: AllOperator;
  value?: number | string;
  value2?: number;
}

interface FilterRowProps {
  rule: FilterDraft;
  onChange: (r: FilterDraft) => void;
  onRemove: () => void;
}

const METRIC_GROUPS = Array.from(
  METRICS.reduce((acc, m) => { acc.set(m.group, [...(acc.get(m.group) ?? []), m]); return acc; }, new Map<string, typeof METRICS[number][]>())
);

function FilterRow({ rule, onChange, onRemove }: FilterRowProps) {
  const isText = TEXT_METRICS.has(rule.metric ?? "");
  const operators = isText ? TEXT_OPERATORS : NUMERIC_OPERATORS;
  const isBetween = rule.operator === "between";

  const textOptions =
    rule.metric === "instrumentType" ? INSTRUMENT_TYPE_OPTIONS :
    rule.metric === "lendability" ? LENDABILITY_OPTIONS :
    null;

  return (
    <div style={{ ...s.row, marginBottom: 8, flexWrap: "wrap" }}>
      <select
        style={{ ...s.select, flex: "0 0 180px" }}
        value={rule.metric ?? ""}
        onChange={(e) => onChange({ metric: e.target.value as AllMetric, operator: undefined, value: undefined, value2: undefined })}
      >
        <option value="">Metric…</option>
        {METRIC_GROUPS.map(([group, items]) => (
          <optgroup key={group} label={group}>
            {items.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </optgroup>
        ))}
      </select>

      <select
        style={{ ...s.select, flex: "0 0 110px" }}
        value={rule.operator ?? ""}
        onChange={(e) => onChange({ ...rule, operator: e.target.value as AllOperator })}
      >
        <option value="">Op…</option>
        {operators.map((op) => (
          <option key={op} value={op}>{op}</option>
        ))}
      </select>

      {isText && textOptions ? (
        <select
          style={{ ...s.select, flex: "1 1 120px" }}
          value={String(rule.value ?? "")}
          onChange={(e) => onChange({ ...rule, value: e.target.value })}
        >
          <option value="">Value…</option>
          {textOptions.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      ) : (
        <input
          style={{ ...s.input, flex: "1 1 100px" }}
          type={isText ? "text" : "number"}
          placeholder={isBetween ? "min" : "value"}
          value={rule.value ?? ""}
          onChange={(e) => onChange({ ...rule, value: isText ? e.target.value : Number(e.target.value) })}
        />
      )}

      {isBetween && (
        <input
          style={{ ...s.input, flex: "1 1 100px" }}
          type="number"
          placeholder="max"
          value={rule.value2 ?? ""}
          onChange={(e) => onChange({ ...rule, value2: Number(e.target.value) })}
        />
      )}

      <button onClick={onRemove} style={{ ...s.btn("danger"), padding: "6px 10px", flexShrink: 0 }}>✕</button>
    </div>
  );
}

interface FormState {
  name: string;
  description: string;
  intervalSeconds: number;
  customInterval: string;
  enabled: boolean;
  filters: FilterDraft[];
}

function defaultForm(scanner?: ScannerDetail): FormState {
  if (!scanner) {
    return { name: "", description: "", intervalSeconds: 300, customInterval: "", enabled: true, filters: [] };
  }
  const preset = INTERVALS.find((i) => i.value === scanner.intervalSeconds && i.value !== -1);
  return {
    name: scanner.name,
    description: scanner.description ?? "",
    intervalSeconds: scanner.intervalSeconds,
    customInterval: preset ? "" : String(scanner.intervalSeconds),
    enabled: scanner.enabled,
    filters: (scanner.filters as FilterDraft[]) ?? [],
  };
}

interface ScannerFormModalProps {
  editId?: string;
  onClose: () => void;
}

function ScannerFormModal({ editId, onClose }: ScannerFormModalProps) {
  const qc = useQueryClient();
  const isEdit = Boolean(editId);

  const { data: existing } = useGetScanner(editId ?? "", {
    query: { queryKey: getGetScannerQueryKey(editId ?? ""), enabled: isEdit },
  });

  const [form, setForm] = useState<FormState>(() => defaultForm(existing));
  const [initialized, setInitialized] = useState(!isEdit);

  if (!initialized && existing) {
    setForm(defaultForm(existing));
    setInitialized(true);
  }

  const createMutation = useCreateScanner({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListScannersQueryKey() });
        onClose();
      },
    },
  });
  const updateMutation = useUpdateScanner({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListScannersQueryKey() });
        if (editId) qc.invalidateQueries({ queryKey: getGetScannerQueryKey(editId) });
        onClose();
      },
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const resolvedInterval =
    form.intervalSeconds === -1
      ? parseInt(form.customInterval || "300", 10)
      : form.intervalSeconds;

  const validFilters = form.filters.filter(
    (f) => f.metric && f.operator && f.value !== undefined && f.value !== "",
  ) as FilterRule[];

  const noFiltersError = validFilters.length === 0 ? "At least one complete filter rule is required." : null;

  const betweenError = validFilters.some(
    (f) => f.operator === "between" && (f.value2 === undefined || f.value2 === null || String(f.value2) === ""),
  )
    ? "One or more 'between' rules is missing a max value."
    : null;

  const submitError = noFiltersError ?? betweenError;

  function handleSubmit() {
    if (submitError) return;
    const payload: CreateScannerRequest = {
      name: form.name,
      description: form.description || null,
      filters: validFilters,
      intervalSeconds: resolvedInterval,
      enabled: form.enabled,
    };

    if (isEdit && editId) {
      updateMutation.mutate({ id: editId, data: payload as UpdateScannerRequest });
    } else {
      createMutation.mutate({ data: payload });
    }
  }

  function addFilter() {
    setForm((f) => ({ ...f, filters: [...f.filters, {}] }));
  }

  function updateFilter(i: number, rule: FilterDraft) {
    setForm((f) => {
      const filters = [...f.filters];
      filters[i] = rule;
      return { ...f, filters };
    });
  }

  function removeFilter(i: number) {
    setForm((f) => ({ ...f, filters: f.filters.filter((_, idx) => idx !== i) }));
  }

  const error = createMutation.error ?? updateMutation.error;

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#e2e8f0" }}>
            {isEdit ? "Edit Scanner" : "New Scanner"}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 18, padding: 4 }}>✕</button>
        </div>

        <div style={s.formGroup}>
          <label style={s.label}>Name</label>
          <input style={s.input} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="High IV Rank" />
        </div>

        <div style={s.formGroup}>
          <label style={s.label}>Description</label>
          <input style={s.input} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optional" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 18 }}>
          <div>
            <label style={s.label}>Run Interval</label>
            <select
              style={{ ...s.select, width: "100%" }}
              value={form.intervalSeconds}
              onChange={(e) => {
                const v = Number(e.target.value);
                setForm((f) => ({ ...f, intervalSeconds: v, customInterval: v === -1 ? f.customInterval : "" }));
              }}
            >
              {INTERVALS.map((i) => (
                <option key={i.value} value={i.value}>{i.label}</option>
              ))}
            </select>
            {form.intervalSeconds === -1 && (
              <input
                style={{ ...s.input, marginTop: 8 }}
                type="number"
                min={60}
                placeholder="Seconds (min 60)"
                value={form.customInterval}
                onChange={(e) => setForm((f) => ({ ...f, customInterval: e.target.value }))}
              />
            )}
          </div>
          <div>
            <label style={s.label}>Status</label>
            <div style={{ display: "flex", alignItems: "center", gap: 12, height: 38 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
                  style={{ width: 16, height: 16, accentColor: "#3b82f6" }}
                />
                <span style={{ fontSize: 13, color: "#94a3b8" }}>Enabled</span>
              </label>
            </div>
          </div>
        </div>

        <div style={s.formGroup}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <label style={{ ...s.label, marginBottom: 0 }}>Filter Rules <span style={{ color: "#334155", fontWeight: 400 }}>(AND logic)</span></label>
            <button onClick={addFilter} style={{ ...s.btn("ghost"), fontSize: 12, padding: "4px 12px" }}>+ Add Rule</button>
          </div>
          {form.filters.length === 0 && (
            <div style={{ color: "#334155", fontSize: 13, padding: "12px 0" }}>No filters — all active symbols will pass</div>
          )}
          {form.filters.map((rule, i) => (
            <FilterRow key={i} rule={rule} onChange={(r) => updateFilter(i, r)} onRemove={() => removeFilter(i)} />
          ))}
        </div>

        {submitError && (
          <div style={{ color: "#f87171", fontSize: 13, marginBottom: 8, padding: "10px 14px", background: "rgba(248,113,113,0.08)", borderRadius: 8 }}>
            {submitError}
          </div>
        )}

        {error && (
          <div style={{ color: "#f87171", fontSize: 13, marginBottom: 16, padding: "10px 14px", background: "rgba(248,113,113,0.08)", borderRadius: 8 }}>
            {String(error)}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24, borderTop: "1px solid #1a1a28", paddingTop: 20 }}>
          <button onClick={onClose} style={s.btn("ghost")} disabled={isPending}>Cancel</button>
          <button
            onClick={handleSubmit}
            style={{ ...s.btn("primary"), opacity: isPending || !form.name || !!submitError ? 0.6 : 1 }}
            disabled={isPending || !form.name || !!submitError}
          >
            {isPending ? "Saving…" : isEdit ? "Save Changes" : "Create Scanner"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface ResultsModalProps {
  scannerId: string;
  scannerName: string;
  onClose: () => void;
}

function ResultsModal({ scannerId, scannerName, onClose }: ResultsModalProps) {
  const { data: results, isLoading } = useGetScannerResults(scannerId, {
    query: { queryKey: getGetScannerResultsQueryKey(scannerId), refetchInterval: 30_000 },
  });

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={{ ...s.modal, width: "min(900px, 95vw)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#e2e8f0" }}>{scannerName}</h2>
            <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>
              {isLoading ? "Loading…" : `${results?.length ?? 0} symbols passing`}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 18, padding: 4 }}>✕</button>
        </div>

        {isLoading ? (
          <div style={{ color: "#475569", textAlign: "center", padding: 40 }}>Loading results…</div>
        ) : !results || results.length === 0 ? (
          <div style={{ color: "#334155", textAlign: "center", padding: 40 }}>
            No symbols currently passing this scanner's filters.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={s.table}>
              <thead>
                <tr>
                  {["Symbol", "IV Rank", "IVx", "Score", "Lendability", "Earnings Date", "Price", "Volume", "Updated"].map((h) => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.symbol} style={{ background: "transparent" }}>
                    <td style={{ ...s.td, fontWeight: 700, color: "#e2e8f0", fontFamily: "monospace" }}>{r.symbol}</td>
                    <td style={s.td}>{r.ivRank?.toFixed(1) ?? "—"}</td>
                    <td style={s.td}>{r.ivx?.toFixed(2) ?? "—"}</td>
                    <td style={s.td}>{r.score?.toFixed(2) ?? "—"}</td>
                    <td style={s.td}>{r.lendability ?? "—"}</td>
                    <td style={s.td}>{r.earningsDate ?? "—"}</td>
                    <td style={s.td}>{r.price?.toFixed(2) ?? "—"}</td>
                    <td style={s.td}>{r.volume?.toLocaleString() ?? "—"}</td>
                    <td style={{ ...s.td, color: "#475569" }}>{formatTs(r.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

interface DeleteConfirmProps {
  scannerName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}

function DeleteConfirm({ scannerName, onConfirm, onCancel, isPending }: DeleteConfirmProps) {
  return (
    <div style={s.overlay} onClick={onCancel}>
      <div style={{ ...s.modal, width: "min(440px, 95vw)" }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 700, color: "#e2e8f0" }}>Delete Scanner</h2>
        <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 24 }}>
          Are you sure you want to delete <strong style={{ color: "#e2e8f0" }}>{scannerName}</strong>? This cannot be undone.
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onCancel} style={s.btn("ghost")} disabled={isPending}>Cancel</button>
          <button onClick={onConfirm} style={{ ...s.btn("danger"), background: "rgba(248,113,113,0.15)" }} disabled={isPending}>
            {isPending ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ScannersPage() {
  const qc = useQueryClient();
  const { data: scanners, isLoading, error } = useListScanners({
    query: { queryKey: getListScannersQueryKey(), refetchInterval: 30_000 },
  });

  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [viewResultsId, setViewResultsId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ScannerSummary | null>(null);

  const deleteMutation = useDeleteScanner({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListScannersQueryKey() });
        setDeleteTarget(null);
      },
    },
  });

  const viewResultsScanner = scanners?.find((s) => s.id === viewResultsId);

  if (isLoading) {
    return <div style={{ color: "#475569", padding: "40px 0", textAlign: "center" }}>Loading scanners…</div>;
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h1 style={s.title}>Scanners</h1>
          <p style={{ color: "#475569", fontSize: 13, marginTop: 4, marginBottom: 0 }}>
            Configure automated filter-based scanners that run on a schedule
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} style={s.btn("primary")}>+ New Scanner</button>
      </div>

      {error && (
        <div style={{ color: "#f87171", fontSize: 13, padding: "12px 16px", background: "rgba(248,113,113,0.08)", borderRadius: 8, marginBottom: 20 }}>
          Failed to load scanners. Is the API server running?
        </div>
      )}

      {!scanners || scanners.length === 0 ? (
        <div style={{ ...s.card, textAlign: "center", padding: "48px 24px" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📡</div>
          <div style={{ color: "#64748b", fontSize: 14 }}>No scanners yet. Create one to get started.</div>
        </div>
      ) : (
        <div style={s.card}>
          <table style={s.table}>
            <thead>
              <tr>
                {["Name", "Status", "Interval", "Filters", "Last Run", "Results", "Actions"].map((h) => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scanners.map((scanner) => (
                <tr key={scanner.id}>
                  <td style={{ ...s.td, color: "#e2e8f0", fontWeight: 600 }}>
                    {scanner.name}
                    {scanner.description && (
                      <div style={{ fontSize: 12, color: "#475569", marginTop: 2, fontWeight: 400 }}>{scanner.description}</div>
                    )}
                  </td>
                  <td style={s.td}>
                    <span style={s.badge(scanner.enabled)}>{scanner.enabled ? "Active" : "Paused"}</span>
                  </td>
                  <td style={{ ...s.td, fontFamily: "monospace" }}>{formatInterval(scanner.intervalSeconds)}</td>
                  <td style={{ ...s.td, color: "#64748b" }}>
                    {scanner.filterCount > 0
                      ? `${scanner.filterCount} rule${scanner.filterCount !== 1 ? "s" : ""}`
                      : "none"}
                  </td>
                  <td style={{ ...s.td, color: "#64748b" }}>{formatTs(scanner.lastRunAt)}</td>
                  <td style={s.td}>
                    <button
                      onClick={() => setViewResultsId(scanner.id)}
                      style={{ background: "none", border: "none", color: "#3b82f6", cursor: "pointer", fontSize: 13, padding: 0 }}
                    >
                      {scanner.resultCount} symbols →
                    </button>
                  </td>
                  <td style={s.td}>
                    <div style={s.row}>
                      <button onClick={() => setEditId(scanner.id)} style={{ ...s.btn("ghost"), padding: "4px 10px", fontSize: 12 }}>Edit</button>
                      <button onClick={() => setDeleteTarget(scanner)} style={{ ...s.btn("danger"), padding: "4px 10px", fontSize: 12 }}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(showCreate || editId) && (
        <ScannerFormModal
          editId={editId ?? undefined}
          onClose={() => { setShowCreate(false); setEditId(null); }}
        />
      )}

      {viewResultsId && viewResultsScanner && (
        <ResultsModal
          scannerId={viewResultsId}
          scannerName={viewResultsScanner.name}
          onClose={() => setViewResultsId(null)}
        />
      )}

      {deleteTarget && (
        <DeleteConfirm
          scannerName={deleteTarget.name}
          onConfirm={() => deleteMutation.mutate({ id: deleteTarget.id })}
          onCancel={() => setDeleteTarget(null)}
          isPending={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
