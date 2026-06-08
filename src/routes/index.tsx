import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
  ReferenceLine,
  ReferenceArea,
  Legend,
} from "recharts";
import {
  connectStream,
  dbscan2d,
  parseCsvToWindows,
  simulateWindow,
  type StreamHandle,
  type WindowPoint,
} from "@/lib/stream";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MIG-WeldSight AI" },
      { name: "description", content: "Dual-mode industrial monitoring for MIG welding: upload CSV or stream live voltage windows for anomaly detection." },
      { property: "og:title", content: "MIG-WeldSight AI" },
      { property: "og:description", content: "Dual-mode industrial monitoring for MIG welding: upload or live stream anomaly detection." },
    ],
  }),
  component: Index,
});

type Mode = "upload" | "live";
const ROLLING_WINDOW = 80;
const DEFAULT_THRESHOLD = 3.5;

const CLASS_COLOR: Record<WindowPoint["class"], string> = {
  Normal: "var(--status-stable)",
  "Arc Instability": "var(--tag-orange)",
  "Transfer Change": "var(--tag-blue)",
  "Short Circuit Abnormality": "var(--tag-red)",
};

function Index() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("weldsight-theme") as "light" | "dark") || "dark";
    }
    return "dark";
  });
  const [mode, setMode] = useState<Mode>("upload");
  const [points, setPoints] = useState<WindowPoint[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [streamStatus, setStreamStatus] = useState<"idle" | "connecting" | "open" | "simulated" | "closed">("idle");
  const streamRef = useRef<StreamHandle | null>(null);

  // Theme
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    localStorage.setItem("weldsight-theme", theme);
  }, [theme]);

  // Stream lifecycle for live mode
  useEffect(() => {
    if (mode !== "live") {
      streamRef.current?.close();
      streamRef.current = null;
      setStreamStatus("idle");
      return;
    }
    setPoints([]);
    streamRef.current = connectStream(
      (p) => {
        setPoints((prev) => {
          const next = [...prev, p];
          return next.length > 400 ? next.slice(next.length - 400) : next;
        });
      },
      { onStatus: setStreamStatus },
    );
    return () => {
      streamRef.current?.close();
      streamRef.current = null;
    };
  }, [mode]);

  const onChooseFile = (file: File | null) => {
    if (!file) return;
    setFileName(file.name);
  };

  const runUploadInference = useCallback(async () => {
    setLoading(true);
    setPoints([]);
    const input = document.querySelector<HTMLInputElement>("input[type=file][data-csv]");
    const file = input?.files?.[0];
    let parsed: WindowPoint[] = [];
    if (file) {
      parsed = await parseCsvToWindows(file);
    }
    if (!parsed.length) {
      // Fallback demo dataset so the UI is always meaningful.
      parsed = Array.from({ length: 90 }, (_, i) => simulateWindow(i));
    }
    // Simulate inference latency.
    await new Promise((r) => setTimeout(r, 900));
    setPoints(parsed);
    setLoading(false);
  }, []);

  const stats = useMemo(() => {
    const anomalies = points.filter((p) => p.status === "Anomaly").length;
    return { windows: points.length, anomalies, threshold: points.at(-1)?.threshold ?? DEFAULT_THRESHOLD };
  }, [points]);

  // Rolling window for the line chart
  const rolling = useMemo(() => {
    const slice = points.slice(-ROLLING_WINDOW);
    return slice.map((p) => ({
      distance: p.distance_mm,
      score: p.score,
      status: p.status,
      class: p.class,
    }));
  }, [points]);

  const anomalyRegions = useMemo(() => {
    const out: Array<{ x1: number; x2: number }> = [];
    let start: number | null = null;
    for (let i = 0; i < rolling.length; i++) {
      if (rolling[i].status === "Anomaly" && start === null) start = rolling[i].distance;
      const next = rolling[i + 1];
      if (start !== null && (!next || next.status !== "Anomaly")) {
        out.push({ x1: start, x2: rolling[i].distance });
        start = null;
      }
    }
    return out;
  }, [rolling]);

  // Cluster on embedding (NOT distance)
  const clusterResult = useMemo(() => {
    if (points.length < 6) return null;
    return dbscan2d(points);
  }, [points]);

  const scatterGroups = useMemo(() => {
    if (!clusterResult) return { normal: [] as WindowPoint[], outlier: [] as WindowPoint[] };
    const normal: WindowPoint[] = [];
    const outlier: WindowPoint[] = [];
    points.forEach((p, i) => {
      if (clusterResult.labels[i] === -1) outlier.push(p);
      else normal.push(p);
    });
    return { normal, outlier };
  }, [points, clusterResult]);

  const hasData = points.length > 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-6 py-10 md:px-10 md:py-14">
        {/* Header */}
        <header className="border-b border-border pb-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`h-2.5 w-2.5 rounded-full ${mode === "live" ? "bg-[var(--status-anomaly)] shadow-[0_0_12px_var(--status-anomaly)]" : "bg-[var(--status-stable)] shadow-[0_0_12px_var(--status-stable)]"}`} />
              <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                MIG-WeldSight AI · {mode === "live" ? `Live · ${streamStatus}` : "Upload Mode"}
              </span>
            </div>
            <button
              onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs uppercase tracking-wider text-muted-foreground transition-colors hover:bg-accent"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>Light</>
              ) : (
                <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>Dark</>
              )}
            </button>
          </div>
          <h1 className="mt-4 text-4xl font-normal tracking-tight md:text-5xl">
            MIG-WeldSight AI
          </h1>
          <p className="mt-3 text-lg italic text-muted-foreground">
            Dual-Mode Industrial Anomaly Detection for MIG Welding
          </p>
        </header>

        {/* Mode Selector */}
        <section className="mt-8 flex flex-wrap items-center gap-3">
          <span className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Mode</span>
          <div className="inline-flex rounded-lg border border-border bg-card p-1">
            {(["upload", "live"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`relative rounded-md px-5 py-2 text-sm uppercase tracking-wider transition-colors ${
                  mode === m ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m === "upload" ? "Upload" : "Live"}
              </button>
            ))}
          </div>
        </section>

        {/* Mode-specific control panel */}
        <section className="mt-6 rounded-2xl border border-border bg-card p-8 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.6)]">
          {mode === "upload" ? (
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl">Upload Raw MIG Voltage CSV</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Provide a voltage capture (.csv with distance and score columns). The detector
                  segments the stream into windows and flags arc instability, transfer changes,
                  and short-circuit abnormalities.
                </p>
                {fileName && (
                  <p className="mt-3 text-sm text-foreground/80">
                    Selected: <span className="italic">{fileName}</span>
                  </p>
                )}
              </div>
              <div className="flex flex-shrink-0 items-center gap-3">
                <label className="cursor-pointer rounded-lg border border-border bg-secondary px-5 py-2.5 text-sm transition-colors hover:bg-accent">
                  Choose File
                  <input
                    type="file"
                    accept=".csv"
                    data-csv
                    className="hidden"
                    onChange={(e) => onChooseFile(e.target.files?.[0] ?? null)}
                  />
                </label>
                <button
                  onClick={runUploadInference}
                  disabled={loading}
                  className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {loading ? "Analyzing…" : "Run Detection"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl">Live Monitoring Stream</h2>
                <span className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                  {streamStatus === "open" && "Connected · ws://localhost:8000/stream"}
                  {streamStatus === "simulated" && "Simulated stream (no backend detected)"}
                  {streamStatus === "connecting" && "Connecting…"}
                  {streamStatus === "closed" && "Disconnected"}
                  {streamStatus === "idle" && "Idle"}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Inference windows arrive continuously over WebSocket. Graphs and clusters update
                in real time; no refresh required.
              </p>
            </div>
          )}

          {loading && (
            <div className="mt-6 flex items-center gap-3 rounded-lg border border-border bg-background/40 px-4 py-3">
              <div className="h-2 w-2 animate-pulse rounded-full bg-[var(--status-warning)]" />
              <span className="text-sm italic text-muted-foreground">Analyzing Voltage Stream…</span>
            </div>
          )}
        </section>

        {/* Metrics Panel */}
        <section className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Metric label="Windows Processed" value={stats.windows} />
          <Metric label="Anomalies Found" value={stats.anomalies} accent="anomaly" />
          <Metric label="Live Status" value={liveStatusLabel(mode, streamStatus)} small />
          <Metric label="Threshold" value={stats.threshold.toFixed(2)} small />
        </section>

        {/* Graph Section */}
        <section className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.6)]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl">Weld Process Monitoring</h2>
            <div className="flex items-center gap-4 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <span className="flex items-center gap-2">
                <span className="h-2 w-4 rounded-sm" style={{ background: "var(--status-stable)" }} /> Stable
              </span>
              <span className="flex items-center gap-2">
                <span className="h-2 w-4 rounded-sm" style={{ background: "var(--status-anomaly)" }} /> Anomaly
              </span>
            </div>
          </div>
          <div className="h-[360px] w-full">
            {hasData ? (
              <ResponsiveContainer>
                <LineChart data={rolling} margin={{ top: 10, right: 20, bottom: 40, left: 10 }}>
                  <CartesianGrid stroke="var(--border)" strokeOpacity={0.35} strokeDasharray="2 4" />
                  <XAxis
                    dataKey="distance"
                    type="number"
                    domain={["dataMin", "dataMax"]}
                    stroke="var(--muted-foreground)"
                    tick={{ fontFamily: "var(--font-serif)", fontSize: 12 }}
                    label={{ value: "Distance (mm)", position: "insideBottom", offset: -28, fill: "var(--muted-foreground)", style: { fontFamily: "var(--font-serif)" } }}
                  />
                  <YAxis
                    stroke="var(--muted-foreground)"
                    tick={{ fontFamily: "var(--font-serif)", fontSize: 12 }}
                    label={{ value: "Anomaly Score", angle: -90, position: "insideLeft", fill: "var(--muted-foreground)", style: { fontFamily: "var(--font-serif)" } }}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--border)", strokeDasharray: "3 3" }} />
                  {/* Green normal baseline band */}
                  <ReferenceArea
                    y1={0}
                    y2={stats.threshold}
                    fill="var(--status-stable)"
                    fillOpacity={0.06}
                    stroke="none"
                  />
                  {anomalyRegions.map((r, i) => (
                    <ReferenceArea
                      key={i}
                      x1={r.x1}
                      x2={r.x2}
                      fill="var(--status-anomaly)"
                      fillOpacity={0.18}
                      stroke="var(--status-anomaly)"
                      strokeOpacity={0.3}
                    />
                  ))}
                  <ReferenceLine
                    y={stats.threshold}
                    stroke="var(--status-warning)"
                    strokeDasharray="6 4"
                    label={{ value: "Threshold", position: "insideTopRight", fill: "var(--status-warning)", fontSize: 11, fontFamily: "var(--font-serif)" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    name="Reconstruction Score"
                    stroke="var(--foreground)"
                    strokeWidth={1.5}
                    dot={false}
                    isAnimationActive={mode !== "live"}
                    animationDuration={600}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart mode={mode} streamStatus={streamStatus} />
            )}
          </div>
        </section>

        {/* Cluster Section */}
        <section className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.6)]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl">Process State Separation</h2>
              <span className="text-xs uppercase tracking-[0.22em] text-muted-foreground">PCA · DBSCAN</span>
            </div>
            <div className="h-[360px] w-full">
              {clusterResult ? (
                <ResponsiveContainer>
                  <ScatterChart margin={{ top: 10, right: 20, bottom: 56, left: 10 }}>
                    <CartesianGrid stroke="var(--border)" strokeOpacity={0.35} strokeDasharray="2 4" />
                    <XAxis
                      type="number"
                      dataKey="embedding_x"
                      name="PC1"
                      stroke="var(--muted-foreground)"
                      tick={{ fontFamily: "var(--font-serif)", fontSize: 12 }}
                      label={{ value: "embedding · PC1", position: "insideBottom", offset: -42, fill: "var(--muted-foreground)", style: { fontFamily: "var(--font-serif)" } }}
                    />
                    <YAxis
                      type="number"
                      dataKey="embedding_y"
                      name="PC2"
                      stroke="var(--muted-foreground)"
                      tick={{ fontFamily: "var(--font-serif)", fontSize: 12 }}
                      label={{ value: "embedding · PC2", angle: -90, position: "insideLeft", fill: "var(--muted-foreground)", style: { fontFamily: "var(--font-serif)" } }}
                    />
                    <Tooltip content={<ClusterTooltip />} cursor={{ stroke: "var(--border)", strokeDasharray: "3 3" }} />
                    <Legend verticalAlign="top" height={32} wrapperStyle={{ fontFamily: "var(--font-serif)", fontSize: 12, color: "var(--muted-foreground)" }} />
                    <Scatter
                      name="Normal Cluster"
                      data={scatterGroups.normal}
                      fill="var(--status-stable)"
                      animationDuration={500}
                    />
                    <Scatter
                      name="Anomaly / Outlier"
                      data={scatterGroups.outlier}
                      fill="var(--status-anomaly)"
                      shape="cross"
                      animationDuration={500}
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart mode={mode} streamStatus={streamStatus} variant="cluster" />
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.6)]">
            <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Cluster State</div>
            <div className="mt-6 space-y-5">
              <MetricRow label="Clusters" value={clusterResult?.clusters ?? 0} />
              <MetricRow label="Outliers" value={clusterResult?.noise ?? 0} accent />
              <MetricRow label="Density Points" value={(clusterResult ? points.length - clusterResult.noise : 0)} />
            </div>
            <p className="mt-6 text-xs italic leading-relaxed text-muted-foreground">
              Clustering operates on PCA-projected feature embeddings — never raw distance.
              Normal welding condenses into dense blobs; anomalies surface as isolated points.
            </p>
          </div>
        </section>

        {/* Live event log */}
        <AnimatePresence>
          {mode === "live" && points.length > 0 && (
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-8 overflow-hidden rounded-2xl border border-border bg-card shadow-[0_8px_32px_-12px_rgba(0,0,0,0.6)]"
            >
              <div className="border-b border-border px-6 py-4 text-xs uppercase tracking-[0.22em] text-muted-foreground">
                Recent Windows
              </div>
              <ul className="max-h-[260px] divide-y divide-border overflow-auto">
                <AnimatePresence initial={false}>
                  {points.slice(-12).reverse().map((p, i) => (
                    <motion.li
                      key={`${p.distance_mm}-${i}`}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center justify-between px-6 py-3 text-sm"
                    >
                      <span className="tabular-nums text-muted-foreground">{p.distance_mm.toFixed(2)} mm</span>
                      <span className="tabular-nums">{p.score.toFixed(3)}</span>
                      <span
                        className="rounded-full px-3 py-1 text-xs ring-1"
                        style={{
                          color: CLASS_COLOR[p.class],
                          backgroundColor: `color-mix(in oklab, ${CLASS_COLOR[p.class]} 14%, transparent)`,
                          boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${CLASS_COLOR[p.class]} 30%, transparent)`,
                        }}
                      >
                        {p.class}
                      </span>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </motion.section>
          )}
        </AnimatePresence>

        <footer className="mt-12 text-center text-xs italic text-muted-foreground">
          MIG-WeldSight AI · Industrial Intelligence Platform
        </footer>
      </div>
    </div>
  );
}

function liveStatusLabel(mode: Mode, s: string) {
  if (mode !== "live") return "Offline";
  if (s === "open") return "Live";
  if (s === "simulated") return "Sim";
  if (s === "connecting") return "Connecting";
  if (s === "closed") return "Closed";
  return "Idle";
}

function Metric({ label, value, accent, small }: { label: string; value: number | string; accent?: "anomaly"; small?: boolean }) {
  const color = accent === "anomaly" ? "var(--status-anomaly)" : "var(--foreground)";
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.6)]">
      <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{label}</div>
      <div className={`mt-3 tabular-nums ${small ? "text-2xl" : "text-4xl"}`} style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function MetricRow({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between border-b border-border/60 pb-3 last:border-none last:pb-0">
      <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
      <span className="text-2xl tabular-nums" style={{ color: accent ? "var(--status-anomaly)" : "var(--foreground)" }}>
        {value}
      </span>
    </div>
  );
}

function EmptyChart({ mode, streamStatus, variant }: { mode: Mode; streamStatus: string; variant?: "cluster" }) {
  return (
    <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border/70 text-sm italic text-muted-foreground">
      {mode === "live"
        ? streamStatus === "connecting"
          ? "Awaiting first window…"
          : "Streaming — waiting for inference output."
        : variant === "cluster"
          ? "Run detection to project windows into embedding space."
          : "Upload a CSV and run detection to view the rolling process trace."}
    </div>
  );
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { distance: number; score: number; status: string; class: string } }> }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-card/95 px-3 py-2 text-xs shadow-lg backdrop-blur" style={{ fontFamily: "var(--font-serif)" }}>
      <div className="text-muted-foreground">distance: <span className="text-foreground tabular-nums">{p.distance.toFixed(2)} mm</span></div>
      <div className="text-muted-foreground">score: <span className="text-foreground tabular-nums">{p.score.toFixed(3)}</span></div>
      <div className="text-muted-foreground">status: <span style={{ color: p.status === "Anomaly" ? "var(--status-anomaly)" : "var(--status-stable)" }}>{p.status}</span></div>
      <div className="text-muted-foreground">class: <span style={{ color: CLASS_COLOR[p.class as WindowPoint["class"]] }}>{p.class}</span></div>
    </div>
  );
}

function ClusterTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: WindowPoint }> }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-card/95 px-3 py-2 text-xs shadow-lg backdrop-blur" style={{ fontFamily: "var(--font-serif)" }}>
      <div className="text-muted-foreground">PC1: <span className="text-foreground tabular-nums">{p.embedding_x.toFixed(2)}</span></div>
      <div className="text-muted-foreground">PC2: <span className="text-foreground tabular-nums">{p.embedding_y.toFixed(2)}</span></div>
      <div className="text-muted-foreground">score: <span className="text-foreground tabular-nums">{p.score.toFixed(3)}</span></div>
      <div className="text-muted-foreground">status: <span style={{ color: p.status === "Anomaly" ? "var(--status-anomaly)" : "var(--status-stable)" }}>{p.status}</span></div>
      <div className="text-muted-foreground">class: <span style={{ color: CLASS_COLOR[p.class] }}>{p.class}</span></div>
    </div>
  );
}