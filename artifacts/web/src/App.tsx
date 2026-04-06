import { useEffect, useState, useCallback } from "react";

interface StatusData {
  status: string;
  uptimeSeconds: number;
  symbolCount: number;
  connectedSymbolCount: number;
  requestCounts: Record<string, number>;
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const ENDPOINTS = [
  { method: "GET",    path: "/api/healthz",                    desc: "Health check" },
  { method: "GET",    path: "/api/symbols",                    desc: "List active symbols" },
  { method: "POST",   path: "/api/symbols/:symbol",            desc: "Add symbol" },
  { method: "DELETE", path: "/api/symbols/:symbol",            desc: "Remove symbol" },
  { method: "GET",    path: "/api/candles/:symbol/:timeframe", desc: "OHLCV candles" },
  { method: "GET",    path: "/api/metrics/:symbol",            desc: "IV metrics" },
];

const METHOD_COLOR: Record<string, string> = {
  GET:    "#4ade80",
  POST:   "#60a5fa",
  DELETE: "#f87171",
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

export default function App() {
  const [data, setData] = useState<StatusData | null>(null);
  const [error, setError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchStatus = useCallback(() => {
    fetch(`${BASE}/api/status`)
      .then((r) => r.json())
      .then((d) => { setData(d); setError(false); setLastUpdated(new Date()); })
      .catch(() => setError(true));
  }, []);

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, 10_000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  const online = data?.status === "ok";
  const totalRequests = data ? Object.values(data.requestCounts).reduce((a, b) => a + b, 0) : 0;

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#e2e8f0", fontFamily: "'Inter', system-ui, sans-serif", padding: "48px 24px" }}>
      <div style={{ maxWidth: 740, margin: "0 auto" }}>

        {/* Header */}
        <header style={{ marginBottom: 40 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: error ? "#f87171" : online ? "#4ade80" : "#94a3b8",
              boxShadow: error ? "0 0 8px #f87171" : online ? "0 0 8px #4ade80" : "none",
              flexShrink: 0,
            }} />
            <span style={{ fontSize: 12, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              {error ? "Unreachable" : online ? "Online" : "Connecting…"}
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
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
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
