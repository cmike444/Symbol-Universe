import { Component, useState } from "react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import ScannersPage from "./pages/ScannersPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

interface StatusData {
  status: string;
  uptimeSeconds: number;
  symbolCount: number;
  connectedSymbolCount: number;
  requestCounts: Record<string, number>;
}

interface ScannerSummary {
  id: string;
  name: string;
  enabled: boolean;
  lastRunAt: number | null;
  resultCount: number;
  intervalSeconds: number;
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const ENDPOINTS = [
  { method: "GET",    path: "/api/healthz",                    desc: "Health check" },
  { method: "GET",    path: "/api/symbols",                    desc: "List active symbols" },
  { method: "POST",   path: "/api/symbols/:symbol",            desc: "Add symbol" },
  { method: "DELETE", path: "/api/symbols/:symbol",            desc: "Remove symbol" },
  { method: "GET",    path: "/api/candles/:symbol/:timeframe", desc: "OHLCV candles" },
  { method: "GET",    path: "/api/metrics/:symbol",            desc: "IV metrics" },
  { method: "GET",    path: "/api/scanners",                   desc: "List scanners" },
  { method: "POST",   path: "/api/scanners",                   desc: "Create scanner" },
  { method: "GET",    path: "/api/scanners/:id",               desc: "Get scanner" },
  { method: "PUT",    path: "/api/scanners/:id",               desc: "Update scanner" },
  { method: "DELETE", path: "/api/scanners/:id",               desc: "Delete scanner" },
  { method: "GET",    path: "/api/scanners/:id/results",       desc: "Scanner results" },
];

const METHOD_COLOR: Record<string, string> = {
  GET:    "#4ade80",
  POST:   "#60a5fa",
  DELETE: "#f87171",
  PUT:    "#fb923c",
};

const OTHER_INTERFACES = [
  {
    icon: "⚡",
    title: "WebSocket",
    lines: ["/api/stream", "/api/stream/:symbol"],
    desc: "Per-symbol rooms emitting price, candle, and scoring events in real time.",
  },
  {
    icon: "🤖",
    title: "MCP (stdio)",
    lines: ["scan_universe", "get_universe", "get_metrics", "get_candles", "add_symbol", "remove_symbol"],
    desc: "6 AI tools accessible over the Model Context Protocol stdio transport.",
  },
];

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function formatTs(ts: number | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleTimeString();
}

function formatInterval(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${seconds / 60}m`;
  if (seconds < 86400) return `${seconds / 3600}h`;
  return `${seconds / 86400}d`;
}

type Page = "dashboard" | "scanners";

function DashboardPage() {
  const { data, error, dataUpdatedAt } = useQuery<StatusData>({
    queryKey: ["status"],
    queryFn: async ({ signal }) => {
      const r = await fetch(`${BASE}/api/status`, { signal });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<StatusData>;
    },
    refetchInterval: 10_000,
    staleTime: 8_000,
  });

  const { data: scanners } = useQuery<ScannerSummary[]>({
    queryKey: ["scanners-summary"],
    queryFn: async ({ signal }) => {
      const r = await fetch(`${BASE}/api/scanners`, { signal });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      return Array.isArray(d) ? (d as ScannerSummary[]) : [];
    },
    refetchInterval: 30_000,
    staleTime: 25_000,
  });

  const online = data?.status === "ok";
  const isError = !!error;
  const totalRequests = data ? Object.values(data.requestCounts).reduce((a, b) => a + b, 0) : 0;
  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt) : null;

  return (
    <div style={{ maxWidth: 740, margin: "0 auto" }}>
      {/* Header */}
      <header style={{ marginBottom: 40 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: isError ? "#f87171" : online ? "#4ade80" : "#94a3b8",
            boxShadow: isError ? "0 0 8px #f87171" : online ? "0 0 8px #4ade80" : "none",
            flexShrink: 0,
          }} />
          <span style={{ fontSize: 12, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {isError ? "Unreachable" : online ? "Online" : "Connecting…"}
          </span>
          {lastUpdated && (
            <span style={{ fontSize: 11, color: "#334155", marginLeft: "auto" }}>
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
        <h1 style={{ fontSize: 30, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>
          Symbol Universe
        </h1>
        <p style={{ color: "#475569", marginTop: 6, fontSize: 14, lineHeight: 1.5 }}>
          Canonical market data layer — OHLCV candles, real-time quotes, and IV metrics.
        </p>
      </header>

      {/* Stat cards */}
      {data && (
        <section style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 36 }}>
          <StatCard label="Active Symbols" value={data.symbolCount} />
          <StatCard label="Connected" value={data.connectedSymbolCount} accent="#60a5fa" />
          <StatCard label="Total Requests" value={totalRequests} />
          <StatCard label="Uptime" value={formatUptime(data.uptimeSeconds)} mono />
        </section>
      )}

      {/* Endpoints + counts */}
      <section style={{ marginBottom: 36 }}>
        <SectionLabel>REST Endpoints</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {ENDPOINTS.map((e) => {
            const count = data?.requestCounts[`${e.method} ${e.path}`] ?? 0;
            return (
              <div key={`${e.method}-${e.path}`} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 14px", borderRadius: 8,
                background: "#0e0e16", border: "1px solid #1a1a28",
              }}>
                <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "monospace", color: METHOD_COLOR[e.method] ?? "#e2e8f0", width: 44, flexShrink: 0 }}>
                  {e.method}
                </span>
                <span style={{ fontSize: 13, fontFamily: "monospace", color: "#b0b0c8", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {e.path}
                </span>
                <span style={{ fontSize: 12, color: "#475569", flexShrink: 0 }}>{e.desc}</span>
                <span style={{ fontSize: 12, fontVariantNumeric: "tabular-nums", color: count > 0 ? "#94a3b8" : "#2d3748", width: 40, textAlign: "right", flexShrink: 0 }}>
                  {count > 0 ? count.toLocaleString() : "—"}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Scanners section */}
      <section style={{ marginBottom: 36 }}>
        <SectionLabel>Scanners {scanners && scanners.length > 0 && `(${scanners.length})`}</SectionLabel>
        {!scanners || scanners.length === 0 ? (
          <div style={{ padding: "20px 16px", background: "#0e0e16", border: "1px solid #1a1a28", borderRadius: 8, color: "#334155", fontSize: 13 }}>
            No scanners configured. Go to the Scanners page to create one.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {scanners.map((sc) => (
              <div key={sc.id} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 14px", borderRadius: 8,
                background: "#0e0e16", border: "1px solid #1a1a28",
              }}>
                <div style={{
                  width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                  background: sc.enabled ? "#4ade80" : "#475569",
                }} />
                <span style={{ fontSize: 13, color: "#e2e8f0", flex: 1, fontWeight: 500 }}>{sc.name}</span>
                <span style={{ fontSize: 12, color: "#475569", fontFamily: "monospace" }}>every {formatInterval(sc.intervalSeconds)}</span>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  {sc.lastRunAt ? `ran ${formatTs(sc.lastRunAt)}` : "never run"}
                </span>
                <span style={{
                  fontSize: 12, fontVariantNumeric: "tabular-nums",
                  color: sc.resultCount > 0 ? "#94a3b8" : "#2d3748",
                  width: 60, textAlign: "right", flexShrink: 0,
                }}>
                  {sc.resultCount > 0 ? `${sc.resultCount} symbols` : "0 symbols"}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Other interfaces */}
      <section>
        <SectionLabel>Other Interfaces</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {OTHER_INTERFACES.map((iface) => (
            <div key={iface.title} style={{ padding: "18px 20px", borderRadius: 10, background: "#0e0e16", border: "1px solid #1a1a28" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 18 }}>{iface.icon}</span>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{iface.title}</span>
              </div>
              <div style={{ marginBottom: 10 }}>
                {iface.lines.map((l) => (
                  <div key={l} style={{ fontSize: 12, fontFamily: "monospace", color: "#64748b", lineHeight: 1.9 }}>{l}</div>
                ))}
              </div>
              <p style={{ fontSize: 12, color: "#334155", lineHeight: 1.6, margin: 0 }}>{iface.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h2 style={{ fontSize: 11, fontWeight: 600, color: "#334155", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
      {children}
    </h2>
  );
}

function StatCard({ label, value, accent, mono }: { label: string; value: string | number; accent?: string; mono?: boolean }) {
  return (
    <div style={{ padding: "14px 16px", borderRadius: 10, background: "#0e0e16", border: "1px solid #1a1a28" }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: accent ?? "#e2e8f0", fontFamily: mono ? "monospace" : "inherit", fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: "#334155", marginTop: 4 }}>{label}</div>
    </div>
  );
}

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; message: string }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(err: unknown) {
    return { hasError: true, message: err instanceof Error ? err.message : String(err) };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: "center", color: "#f87171" }}>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Something went wrong</div>
          <div style={{ fontSize: 13, color: "#64748b" }}>{this.state.message}</div>
          <button
            onClick={() => this.setState({ hasError: false, message: "" })}
            style={{ marginTop: 20, padding: "8px 16px", background: "#1e293b", border: "1px solid #334155", borderRadius: 8, color: "#e2e8f0", cursor: "pointer", fontSize: 13 }}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const NAV_ITEMS: Array<{ id: Page; label: string }> = [
  { id: "dashboard", label: "Dashboard" },
  { id: "scanners", label: "Scanners" },
];

export default function App() {
  const [page, setPage] = useState<Page>("dashboard");

  return (
    <QueryClientProvider client={queryClient}>
      <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#e2e8f0", fontFamily: "'Inter', system-ui, sans-serif" }}>
        {/* Top navigation */}
        <nav style={{
          borderBottom: "1px solid #1a1a28",
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          gap: 2,
          height: 52,
          position: "sticky",
          top: 0,
          background: "#0a0a0f",
          zIndex: 10,
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#64748b", marginRight: 20, letterSpacing: "-0.01em" }}>
            ◈ Symbol Universe
          </span>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              style={{
                background: "none",
                border: "none",
                padding: "6px 14px",
                fontSize: 13,
                fontWeight: page === item.id ? 600 : 400,
                color: page === item.id ? "#e2e8f0" : "#64748b",
                cursor: "pointer",
                borderRadius: 8,
                position: "relative",
              }}
            >
              {item.label}
              {page === item.id && (
                <div style={{
                  position: "absolute", bottom: -1, left: 8, right: 8,
                  height: 2, background: "#3b82f6", borderRadius: 2,
                }} />
              )}
            </button>
          ))}
        </nav>

        {/* Page content */}
        <main style={{ padding: "40px 24px" }}>
          <ErrorBoundary>
            {page === "dashboard" && <DashboardPage />}
            {page === "scanners" && (
              <div style={{ maxWidth: 960, margin: "0 auto" }}>
                <ScannersPage />
              </div>
            )}
          </ErrorBoundary>
        </main>
      </div>
    </QueryClientProvider>
  );
}
