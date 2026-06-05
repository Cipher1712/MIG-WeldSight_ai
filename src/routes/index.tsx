import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WeldSight AI – Welding Anomaly Monitoring" },
      { name: "description", content: "Real-time MIG voltage monitoring and defect detection dashboard." },
      { property: "og:title", content: "WeldSight AI – Welding Anomaly Monitoring" },
      { property: "og:description", content: "Real-time MIG voltage monitoring and defect detection dashboard." },
    ],
  }),
  component: Index,
});

type Row = {
  distance: number;
  score: number;
  status: "Stable" | "Anomaly";
  classification: "Normal" | "Arc Instability" | "Transfer Change" | "Short Circuit Abnormality";
};

const ANOMALY_THRESHOLD = 3.5;

function generateSeed(): Row[] {
  // Deterministic pseudo-random for stable visuals.
  let s = 7;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const rows: Row[] = [];
  const anomalies: Array<{ at: number; cls: Row["classification"] }> = [
    { at: 42, cls: "Arc Instability" },
    { at: 78, cls: "Transfer Change" },
    { at: 96, cls: "Arc Instability" },
    { at: 124, cls: "Short Circuit Abnormality" },
    { at: 151, cls: "Transfer Change" },
  ];
  for (let i = 0; i < 80; i++) {
    const distance = +(i * 2.1 + rand() * 0.8).toFixed(2);
    const hit = anomalies.find((a) => Math.abs(a.at - distance) < 2.5);
    let score: number;
    let status: Row["status"];
    let classification: Row["classification"];
    if (hit) {
      score = +(4 + rand() * 9).toFixed(2);
      status = "Anomaly";
      classification = hit.cls;
    } else {
      score = +(0.2 + rand() * 1.8).toFixed(2);
      status = "Stable";
      classification = "Normal";
    }
    rows.push({ distance, score, status, classification });
  }
  return rows;
}

const SEED: Row[] = generateSeed();

const CLASS_COLOR: Record<Row["classification"], string> = {
  Normal: "var(--status-stable)",
  "Arc Instability": "var(--tag-orange)",
  "Transfer Change": "var(--tag-blue)",
  "Short Circuit Abnormality": "var(--tag-red)",
};

// Simple DBSCAN over (distance, score) with scaled features.
function dbscan(points: Row[], eps = 0.6, minPts = 4) {
  const xs = points.map((p) => p.distance);
  const ys = points.map((p) => p.score);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const norm = points.map((p) => [
    (p.distance - xMin) / (xMax - xMin || 1),
    (p.score - yMin) / (yMax - yMin || 1),
  ]);
  const labels = new Array(points.length).fill(-2); // unvisited
  const dist = (a: number[], b: number[]) =>
    Math.hypot(a[0] - b[0], a[1] - b[1]);
  const neighbors = (i: number) => {
    const out: number[] = [];
    for (let j = 0; j < norm.length; j++) {
      if (i !== j && dist(norm[i], norm[j]) <= eps) out.push(j);
    }
    return out;
  };
  let cluster = 0;
  for (let i = 0; i < points.length; i++) {
    if (labels[i] !== -2) continue;
    const n = neighbors(i);
    if (n.length < minPts) {
      labels[i] = -1; // noise
      continue;
    }
    labels[i] = cluster;
    const queue = [...n];
    while (queue.length) {
      const q = queue.shift()!;
      if (labels[q] === -1) labels[q] = cluster;
      if (labels[q] !== -2) continue;
      labels[q] = cluster;
      const qn = neighbors(q);
      if (qn.length >= minPts) queue.push(...qn);
    }
    cluster++;
  }
  // Purity: fraction of points whose class matches the dominant class of their cluster.
  let matched = 0;
  let counted = 0;
  for (let c = 0; c < cluster; c++) {
    const members = points.filter((_, idx) => labels[idx] === c);
    if (!members.length) continue;
    const counts: Record<string, number> = {};
    for (const m of members) counts[m.classification] = (counts[m.classification] || 0) + 1;
    const top = Math.max(...Object.values(counts));
    matched += top;
    counted += members.length;
  }
  const purity = counted ? matched / counted : 0;
  const noise = labels.filter((l) => l === -1).length;
  return { labels, clusters: cluster, purity, noise };
}

function movingAverage(rows: Row[], window = 5) {
  return rows.map((r, i) => {
    const start = Math.max(0, i - Math.floor(window / 2));
    const end = Math.min(rows.length, i + Math.ceil(window / 2));
    const slice = rows.slice(start, end);
    const avg = slice.reduce((a, b) => a + b.score, 0) / slice.length;
    return { distance: r.distance, score: r.score, ma: +avg.toFixed(3), classification: r.classification, status: r.status };
  });
}

function classificationStyle(c: Row["classification"]) {
  switch (c) {
    case "Arc Instability":
      return "bg-[color-mix(in_oklab,var(--tag-orange)_18%,transparent)] text-[var(--tag-orange)] ring-[color-mix(in_oklab,var(--tag-orange)_35%,transparent)]";
    case "Transfer Change":
      return "bg-[color-mix(in_oklab,var(--tag-blue)_18%,transparent)] text-[var(--tag-blue)] ring-[color-mix(in_oklab,var(--tag-blue)_35%,transparent)]";
    case "Short Circuit Abnormality":
      return "bg-[color-mix(in_oklab,var(--tag-red)_18%,transparent)] text-[var(--tag-red)] ring-[color-mix(in_oklab,var(--tag-red)_35%,transparent)]";
    default:
      return "bg-muted text-muted-foreground ring-border";
  }
}

function Index() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("weldsight-theme") as "light" | "dark") || "dark";
    }
    return "dark";
  });
  const [rows, setRows] = useState<Row[]>([]);
  const [hasRun, setHasRun] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"All" | "Stable" | "Anomaly">("All");

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filter !== "All" && r.status !== filter) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        r.classification.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q) ||
        String(r.distance).includes(q) ||
        String(r.score).includes(q)
      );
    });
  }, [rows, search, filter]);

  const stats = useMemo(
    () => ({
      windows: rows.length,
      anomalies: rows.filter((r) => r.status === "Anomaly").length,
    }),
    [rows],
  );

  const cluster = useMemo(() => (rows.length ? dbscan(rows) : null), [rows]);
  const scatterByClass = useMemo(() => {
    const groups: Record<string, Row[]> = {};
    for (const r of rows) (groups[r.classification] ||= []).push(r);
    return groups;
  }, [rows]);
  const trendData = useMemo(() => movingAverage(rows), [rows]);
  const anomalyRegions = useMemo(() => {
    const out: Array<{ x1: number; x2: number }> = [];
    let start: number | null = null;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].status === "Anomaly" && start === null) start = rows[i].distance;
      const next = rows[i + 1];
      if (start !== null && (!next || next.status !== "Anomaly")) {
        out.push({ x1: start, x2: rows[i].distance });
        start = null;
      }
    }
    return out;
  }, [rows]);

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("weldsight-theme", theme);
  }, [theme]);

  function runDetection() {
    setLoading(true);
    setHasRun(false);
    setTimeout(() => {
      setRows(SEED);
      setLoading(false);
      setHasRun(true);
    }, 1600);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-6 py-10 md:px-10 md:py-14">
        {/* Header */}
        <header className="border-b border-border pb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-2.5 w-2.5 rounded-full bg-[var(--status-stable)] shadow-[0_0_12px_var(--status-stable)]" />
              <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                WeldSight AI &middot; System Online
              </span>
            </div>
            <button
              onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs uppercase tracking-wider text-muted-foreground transition-colors hover:bg-accent"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
                  Light
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                  Dark
                </>
              )}
            </button>
          </div>
          <h1 className="mt-4 text-4xl font-normal tracking-tight md:text-5xl">
            WeldSight AI Welding Anomaly Monitoring
          </h1>
          <p className="mt-3 text-lg italic text-muted-foreground">
            Real-Time MIG Voltage Monitoring and Defect Detection
          </p>
        </header>

        {/* Upload section */}
        <section className="mt-10 rounded-2xl border border-border bg-card p-8 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.6)]">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl">Upload Raw MIG Voltage CSV</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Provide a voltage stream capture (.csv). The detector segments the stream
                into windows and flags arc instability, transfer changes, and short-circuit
                abnormalities.
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
                  className="hidden"
                  onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
                />
              </label>
              <button
                onClick={runDetection}
                disabled={loading}
                className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Analyzing…" : "Run Detection"}
              </button>
            </div>
          </div>

          {loading && (
            <div className="mt-6 flex items-center gap-3 rounded-lg border border-border bg-background/40 px-4 py-3">
              <div className="h-2 w-2 animate-pulse rounded-full bg-[var(--status-warning)]" />
              <span className="text-sm italic text-muted-foreground">
                Analyzing Voltage Stream…
              </span>
            </div>
          )}
        </section>

        {/* Stats */}
        {hasRun && (
          <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <StatCard label="Total Windows Processed" value={stats.windows} />
            <StatCard
              label="Total Anomalies Found"
              value={stats.anomalies}
              accent="anomaly"
            />
          </section>
        )}

        {/* Controls */}
        {hasRun && (
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search results…"
              className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none sm:max-w-xs"
            />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as typeof filter)}
              className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm focus:border-ring focus:outline-none"
            >
              <option value="All">All</option>
              <option value="Stable">Stable</option>
              <option value="Anomaly">Anomaly</option>
            </select>
          </div>
        )}

        {/* Table */}
        {hasRun && (
          <section className="mt-4 overflow-hidden rounded-2xl border border-border bg-card shadow-[0_8px_32px_-12px_rgba(0,0,0,0.6)]">
            <div className="max-h-[520px] overflow-auto">
              <table className="w-full border-collapse text-left">
                <thead className="sticky top-0 z-10 bg-secondary/95 backdrop-blur">
                  <tr className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    <Th>Distance (mm)</Th>
                    <Th>Anomaly Score</Th>
                    <Th>Status</Th>
                    <Th>Classification</Th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => (
                    <tr
                      key={i}
                      className={`group border-t border-border transition-colors hover:bg-accent/60 ${
                        i % 2 === 0 ? "bg-transparent" : "bg-background/30"
                      }`}
                    >
                      <Td className="text-lg">{r.distance.toFixed(1)}</Td>
                      <Td className="text-lg tabular-nums">{r.score.toFixed(2)}</Td>
                      <Td>
                        <StatusBadge status={r.status} />
                      </Td>
                      <Td>
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-sm ring-1 ${classificationStyle(
                            r.classification,
                          )}`}
                        >
                          {r.classification}
                        </span>
                      </Td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-6 py-12 text-center text-sm italic text-muted-foreground"
                      >
                        No matching results.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Cluster Visualization */}
        {hasRun && cluster && (
          <section className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.6)]">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-2xl">Anomaly Cluster Separation</h2>
                <span className="text-xs uppercase tracking-[0.22em] text-muted-foreground">DBSCAN</span>
              </div>
              <div className="h-[360px] w-full">
                <ResponsiveContainer>
                  <ScatterChart margin={{ top: 10, right: 20, bottom: 56, left: 10 }}>
                    <CartesianGrid stroke="var(--border)" strokeOpacity={0.35} strokeDasharray="2 4" />
                    <XAxis
                      type="number"
                      dataKey="distance"
                      name="distance_mm"
                      stroke="var(--muted-foreground)"
                      tick={{ fontFamily: "var(--font-serif)", fontSize: 12 }}
                      label={{ value: "distance_mm", position: "insideBottom", offset: -42, fill: "var(--muted-foreground)", style: { fontFamily: "var(--font-serif)" } }}
                    />
                    <YAxis
                      type="number"
                      dataKey="score"
                      name="score"
                      stroke="var(--muted-foreground)"
                      tick={{ fontFamily: "var(--font-serif)", fontSize: 12 }}
                      label={{ value: "score", angle: -90, position: "insideLeft", fill: "var(--muted-foreground)", style: { fontFamily: "var(--font-serif)" } }}
                    />
                    <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--border)", strokeDasharray: "3 3" }} />
                    <Legend verticalAlign="top" height={32} wrapperStyle={{ fontFamily: "var(--font-serif)", fontSize: 12, color: "var(--muted-foreground)" }} />
                    {Object.entries(scatterByClass).map(([cls, pts]) => (
                      <Scatter
                        key={cls}
                        name={cls}
                        data={pts}
                        fill={CLASS_COLOR[cls as Row["classification"]]}
                        animationDuration={800}
                      />
                    ))}
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.6)]">
              <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                Cluster Separation Quality
              </div>
              <div className="mt-6 space-y-5">
                <MetricRow label="Clusters" value={cluster.clusters} />
                <MetricRow label="Cluster Purity" value={`${(cluster.purity * 100).toFixed(1)}%`} accent />
                <MetricRow label="Noise Points" value={cluster.noise} />
              </div>
              <p className="mt-6 text-xs italic leading-relaxed text-muted-foreground">
                Normal windows condense into dense clusters; anomalies surface as
                isolated noise points outside the manifold.
              </p>
            </div>
          </section>
        )}

        {/* Trend Visualization */}
        {hasRun && (
          <section className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.6)]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl">Weld Process Behavior</h2>
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
              <ResponsiveContainer>
                <LineChart data={trendData} margin={{ top: 10, right: 20, bottom: 40, left: 10 }}>
                  <CartesianGrid stroke="var(--border)" strokeOpacity={0.35} strokeDasharray="2 4" />
                  <XAxis
                    dataKey="distance"
                    type="number"
                    domain={["dataMin", "dataMax"]}
                    stroke="var(--muted-foreground)"
                    tick={{ fontFamily: "var(--font-serif)", fontSize: 12 }}
                    label={{ value: "distance_mm", position: "insideBottom", offset: -28, fill: "var(--muted-foreground)", style: { fontFamily: "var(--font-serif)" } }}
                  />
                  <YAxis
                    stroke="var(--muted-foreground)"
                    tick={{ fontFamily: "var(--font-serif)", fontSize: 12 }}
                    label={{ value: "score", angle: -90, position: "insideLeft", fill: "var(--muted-foreground)", style: { fontFamily: "var(--font-serif)" } }}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--border)", strokeDasharray: "3 3" }} />
                  {anomalyRegions.map((r, i) => (
                    <ReferenceArea
                      key={i}
                      x1={r.x1}
                      x2={r.x2}
                      fill="var(--status-anomaly)"
                      fillOpacity={0.12}
                      stroke="var(--status-anomaly)"
                      strokeOpacity={0.25}
                    />
                  ))}
                  <ReferenceLine
                    y={ANOMALY_THRESHOLD}
                    stroke="var(--status-warning)"
                    strokeDasharray="6 4"
                    label={{ value: "Reconstruction Threshold", position: "insideTopRight", fill: "var(--status-warning)", fontSize: 11, fontFamily: "var(--font-serif)" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    name="score"
                    stroke="var(--foreground)"
                    strokeWidth={1.5}
                    dot={false}
                    animationDuration={800}
                  />
                  <Line
                    type="monotone"
                    dataKey="ma"
                    name="moving avg"
                    stroke="var(--tag-blue)"
                    strokeWidth={2}
                    strokeDasharray="4 3"
                    dot={false}
                    animationDuration={800}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        <footer className="mt-12 text-center text-xs italic text-muted-foreground">
          WeldSight AI · Industrial Intelligence Platform
        </footer>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-6 py-4 font-normal">{children}</th>;
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-6 py-4 ${className}`}>{children}</td>;
}

function StatusBadge({ status }: { status: Row["status"] }) {
  const stable = status === "Stable";
  const color = stable ? "var(--status-stable)" : "var(--status-anomaly)";
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm ring-1"
      style={{
        backgroundColor: `color-mix(in oklab, ${color} 16%, transparent)`,
        color,
        boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${color} 35%, transparent)`,
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
      />
      {status}
    </span>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "anomaly";
}) {
  const color = accent === "anomaly" ? "var(--status-anomaly)" : "var(--status-stable)";
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.6)]">
      <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{label}</div>
      <div className="mt-3 flex items-baseline gap-3">
        <span className="text-5xl tabular-nums" style={{ color }}>
          {value}
        </span>
        <span className="text-sm italic text-muted-foreground">windows</span>
      </div>
    </div>
  );
}

function MetricRow({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between border-b border-border/60 pb-3 last:border-none last:pb-0">
      <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
      <span
        className="text-2xl tabular-nums"
        style={{ color: accent ? "var(--status-stable)" : "var(--foreground)" }}
      >
        {value}
      </span>
    </div>
  );
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: Row & { ma?: number } }> }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-card/95 px-3 py-2 text-xs shadow-lg backdrop-blur" style={{ fontFamily: "var(--font-serif)" }}>
      <div className="mb-1 text-muted-foreground">distance_mm: <span className="text-foreground">{p.distance.toFixed(2)}</span></div>
      <div className="text-muted-foreground">score: <span className="text-foreground tabular-nums">{p.score.toFixed(3)}</span></div>
      {typeof p.ma === "number" && (
        <div className="text-muted-foreground">moving avg: <span className="text-foreground tabular-nums">{p.ma.toFixed(3)}</span></div>
      )}
      {p.status && (
        <div className="mt-1 text-muted-foreground">status: <span style={{ color: p.status === "Anomaly" ? "var(--status-anomaly)" : "var(--status-stable)" }}>{p.status}</span></div>
      )}
      {p.classification && (
        <div className="text-muted-foreground">classification: <span style={{ color: CLASS_COLOR[p.classification] }}>{p.classification}</span></div>
      )}
    </div>
  );
}
