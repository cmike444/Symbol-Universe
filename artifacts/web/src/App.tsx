import { useEffect, useState } from "react";

interface HealthStatus {
  status: string;
  symbolCount?: number;
  connectedSymbolCount?: number;
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const ENDPOINTS = [
  { method: "GET", path: "/api/healthz", desc: "Health check (public)", auth: false },
  { method: "GET", path: "/api/symbols", desc: "List active symbols", auth: true },
  { method: "POST", path: "/api/symbols/:symbol", desc: "Add symbol to universe", auth: true },
  { method: "DELETE", path: "/api/symbols/:symbol", desc: "Remove symbol", auth: true },
  { method: "GET", path: "/api/candles/:symbol/:timeframe", desc: "OHLCV candle data (1d / 60m / 15m)", auth: true },
  { method: "GET", path: "/api/metrics/:symbol", desc: "IV rank, IVx, earnings date", auth: true },
];

const METHOD_COLORS: Record<string, string> = {
  GET: "#4ade80",
  POST: "#60a5fa",
  DELETE: "#f87171",
};

export default function App() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`${BASE}/api/healthz`)
      .then((r) => r.json())
      .then((d) => setHealth(d))
      .catch(() => setError(true));
  }, []);

  const online = health?.status === "ok";

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#e2e8f0", fontFamily: "'Inter', system-ui, sans-serif", padding: "48px 24px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>

        <header style={{ marginBottom: 48 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div style={{
              width: 10, height: 10, borderRadius: "50%",
              background: error ? "#f87171" : online ? "#4ade80" : "#94a3b8",
              boxShadow: error ? "0 0 8px #f87171" : online ? "0 0 8px #4ade80" : "none",
            }} />
            <span style={{ fontSize: 13, color: "#94a3b8", letterSpacing: "0.05em", textTransform: "uppercase" }}>
              {error ? "Unreachable" : online ? "Online" : "Connecting…"}
            </span>
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>
            Symbol Universe
          </h1>
          <p style={{ color: "#64748b", marginTop: 8, fontSize: 15 }}>
            Canonical market data layer — OHLCV candles, real-time quotes, and IV metrics over REST &amp; WebSocket.
          </p>
        </header>

        {health && (
          <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 40 }}>
            <Stat label="Active Symbols (DB)" value={health.symbolCount ?? 0} />
            <Stat label="Connected Subscriptions" value={health.connectedSymbolCount ?? 0} />
          </section>
        )}

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16 }}>
            REST Endpoints
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {ENDPOINTS.map((e) => (
              <div key={`${e.method}-${e.path}`} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 14px", borderRadius: 8,
                background: "#111117", border: "1px solid #1e1e2e",
              }}>
                <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "monospace", color: METHOD_COLORS[e.method] ?? "#e2e8f0", width: 46 }}>
                  {e.method}
                </span>
                <span style={{ fontSize: 13, fontFamily: "monospace", color: "#c4c4d4", flexShrink: 0 }}>
                  {e.path}
                </span>
                <span style={{ fontSize: 12, color: "#475569", marginLeft: "auto", whiteSpace: "nowrap" }}>
                  {e.desc}
                </span>
                {e.auth && (
                  <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "#1e293b", color: "#94a3b8", flexShrink: 0 }}>
                    Bearer
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16 }}>
            Other Interfaces
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Card icon="⚡" title="WebSocket" desc="Per-symbol rooms at /api/stream and /api/stream/:symbol. Emits price, candle, and scoring events." />
            <Card icon="🤖" title="MCP Tools" desc="6 AI tools via stdio: scan_universe, get_candles, get_metrics, add_symbol, remove_symbol, get_universe." />
          </div>
        </section>

        <footer style={{ fontSize: 12, color: "#334155", borderTop: "1px solid #1e1e2e", paddingTop: 24 }}>
          Authentication required on all endpoints except <code style={{ color: "#64748b" }}>/api/healthz</code> — pass <code style={{ color: "#64748b" }}>Authorization: Bearer &lt;INTERNAL_API_TOKEN&gt;</code>
        </footer>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ padding: "16px 20px", borderRadius: 10, background: "#111117", border: "1px solid #1e1e2e" }}>
      <div style={{ fontSize: 28, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{label}</div>
    </div>
  );
}

function Card({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div style={{ padding: "16px 20px", borderRadius: 10, background: "#111117", border: "1px solid #1e1e2e" }}>
      <div style={{ fontSize: 20, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>{desc}</div>
    </div>
  );
}
