import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  connectStream,
  dbscan2d,
  parseCsvToWindows,
  simulateWindow,
  type StreamHandle,
  type WindowPoint,
} from "@/lib/stream";
import { classifyWindow, deriveFeatures, type PhysicsResult } from "@/lib/physicsClassifier";
import { computeQualityIndex } from "@/lib/qualityIndex";
import {
  getProfile,
  saveProfile,
  type BaselineProfile,
  type ProcessSetup,
} from "@/lib/profiles";

import { ProcessSetupPanel } from "@/components/weldsight/ProcessSetupPanel";
import { RawVoltageChart } from "@/components/weldsight/RawVoltageChart";
import { QualityIndexCard } from "@/components/weldsight/QualityIndexCard";
import { PhysicsInsightPanel } from "@/components/weldsight/PhysicsInsightPanel";
import { PhysicsEventsTimeline } from "@/components/weldsight/PhysicsEventsTimeline";
import { RecentEventsTable } from "@/components/weldsight/RecentEventsTable";
import { TrainingPanel } from "@/components/weldsight/TrainingPanel";
import { HistoricalAnalytics, type HistoryEvent } from "@/components/weldsight/HistoricalAnalytics";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MIG-WeldSight AI · Industrial Welding Monitoring" },
      {
        name: "description",
        content:
          "Production-grade MIG welding monitoring: live ESP32 streams, material- and thickness-aware physics diagnosis, and traceable quality records.",
      },
      { property: "og:title", content: "MIG-WeldSight AI" },
      { property: "og:description", content: "Industrial MIG welding monitoring platform." },
    ],
  }),
  component: Dashboard,
});

type Tab = "upload" | "live" | "training" | "history";
const HISTORY_KEY = "weldsight.history.v1";
const ROLLING = 100;
const DEFAULT_FLOOR = 3.5;

type EnrichedPoint = WindowPoint & {
  physics: PhysicsResult;
  thresholdValue: number;
  warmup: boolean;
  quality: number;
};

function Dashboard() {
  // theme
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "dark";
    return (localStorage.getItem("weldsight-theme") as "light" | "dark") ?? "dark";
  });
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("weldsight-theme", theme);
  }, [theme]);

  // process setup + profile lookup
  const [setup, setSetup] = useState<ProcessSetup>({ material: "mild_steel", thickness_mm: 6 });
  const [profile, setProfile] = useState<BaselineProfile | null>(null);
  useEffect(() => {
    setProfile(getProfile(setup));
  }, [setup]);

  // tab
  const [tab, setTab] = useState<Tab>("upload");

  // shared dataset (upload puts a full batch in; live appends)
  const [points, setPoints] = useState<WindowPoint[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [streamStatus, setStreamStatus] = useState<"idle" | "connecting" | "open" | "simulated" | "closed">("idle");
  const streamRef = useRef<StreamHandle | null>(null);

  // history (traceability)
  const [history, setHistory] = useState<HistoryEvent[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
    } catch {
      return [];
    }
  });
  const persistHistory = useCallback((next: HistoryEvent[]) => {
    setHistory(next);
    if (typeof window !== "undefined") localStorage.setItem(HISTORY_KEY, JSON.stringify(next.slice(-1000)));
  }, []);

  // live stream lifecycle (only when on live tab)
  useEffect(() => {
    if (tab !== "live") {
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
          return next.length > 500 ? next.slice(next.length - 500) : next;
        });
      },
      { onStatus: setStreamStatus },
    );
    return () => {
      streamRef.current?.close();
      streamRef.current = null;
    };
  }, [tab]);

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
    if (file) parsed = await parseCsvToWindows(file);
    if (!parsed.length) parsed = Array.from({ length: 96 }, (_, i) => simulateWindow(i));
    await new Promise((r) => setTimeout(r, 700));
    setPoints(parsed);
    setLoading(false);
  }, []);

  // enrich points with threshold + physics + quality (no operator-tunable k)
  const enriched = useMemo<EnrichedPoint[]>(() => {
    const k = profile?.learned_k ?? 3.0;
    const warmupN = profile ? 0 : 30;
    const floor = profile ? Math.max(profile.mean_score + 1.5 * profile.std_score, DEFAULT_FLOOR * 0.85) : DEFAULT_FLOOR;
    const ewmaA = 0.15;
    const varA = 0.08;
    let mean = 0;
    let variance = 0;
    let n = 0;
    let prevScore = 0;
    return points.map((p, i) => {
      n += 1;
      if (n === 1) {
        mean = p.score;
        variance = 0;
      } else {
        const dev = p.score - mean;
        mean = ewmaA * p.score + (1 - ewmaA) * mean;
        variance = (1 - varA) * variance + varA * dev * dev;
      }
      const sigma = Math.sqrt(variance);
      const warmup = n < warmupN;
      const adaptive = mean + k * sigma;
      const thresholdValue = +(warmup ? floor : Math.max(adaptive, floor * 0.85)).toFixed(3);
      const features = deriveFeatures(p.score, prevScore, i);
      const physics = classifyWindow(p.score, thresholdValue, features, {
        material: setup.material,
        thickness_mm: setup.thickness_mm,
      });
      const quality = computeQualityIndex({
        std_v: features.std_v,
        sc_count: features.sc_count,
        crest_factor: features.crest_factor,
        score: p.score,
        ewma: mean,
      }).value;
      prevScore = p.score;
      return { ...p, physics, thresholdValue, warmup, quality };
    });
  }, [points, profile, setup.material, setup.thickness_mm]);

  // traceability: whenever a new anomaly enters `enriched`, append to history
  const lastTracedRef = useRef<number>(0);
  useEffect(() => {
    if (!enriched.length) return;
    const fresh = enriched.slice(lastTracedRef.current);
    if (!fresh.length) return;
    const anomalies = fresh
      .filter((e) => e.physics.severity !== "NORMAL")
      .map<HistoryEvent>((e) => ({
        timestamp: e.timestamp ?? Date.now(),
        material: setup.material,
        thickness_mm: setup.thickness_mm,
        severity: e.physics.severity,
        quality: e.quality,
        score: e.score,
      }));
    if (anomalies.length) persistHistory([...history, ...anomalies]);
    lastTracedRef.current = enriched.length;
  }, [enriched, history, persistHistory, setup.material, setup.thickness_mm]);

  const stats = useMemo(() => {
    const anomalies = enriched.filter((p) => p.physics.severity !== "NORMAL").length;
    const latest = enriched.at(-1);
    const avgQ = enriched.length ? Math.round(enriched.reduce((s, e) => s + e.quality, 0) / enriched.length) : 0;
    return {
      windows: enriched.length,
      anomalies,
      threshold: latest?.thresholdValue ?? DEFAULT_FLOOR,
      quality: latest?.quality ?? avgQ,
    };
  }, [enriched]);

  const latestPhysics = enriched.at(-1)?.physics ?? null;

  const rolling = useMemo(
    () =>
      enriched.slice(-ROLLING).map((p) => ({
        distance: p.distance_mm,
        score: p.score,
        threshold: p.thresholdValue,
        status: p.status,
        severity: p.physics.severity,
        colour: p.physics.colour,
        voltage: p.voltage ?? 0,
      })),
    [enriched],
  );
  const rawVoltage = useMemo(() => rolling.map((r) => ({ distance: r.distance, voltage: r.voltage })), [rolling]);

  const anomalyRegions = useMemo(() => {
    const out: Array<{ x1: number; x2: number }> = [];
    let start: number | null = null;
    for (let i = 0; i < rolling.length; i++) {
      if (rolling[i].severity !== "NORMAL" && start === null) start = rolling[i].distance;
      const next = rolling[i + 1];
      if (start !== null && (!next || next.severity === "NORMAL")) {
        out.push({ x1: start, x2: rolling[i].distance });
        start = null;
      }
    }
    return out;
  }, [rolling]);

  const clusterResult = useMemo(() => (points.length >= 6 ? dbscan2d(points) : null), [points]);
  const scatterGroups = useMemo(() => {
    const normal: WindowPoint[] = [];
    const outlier: WindowPoint[] = [];
    if (clusterResult)
      points.forEach((p, i) => (clusterResult.labels[i] === -1 ? outlier.push(p) : normal.push(p)));
    return { normal, outlier };
  }, [points, clusterResult]);

  const quality = computeQualityIndex({
    std_v: latestPhysics?.features.std_v ?? 0.4,
    sc_count: latestPhysics?.features.sc_count ?? 2,
    crest_factor: latestPhysics?.features.crest_factor ?? 1.1,
    score: enriched.at(-1)?.score ?? 0,
    ewma: enriched.at(-1)?.score ?? 0,
  });

  const hasData = enriched.length > 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-6 py-10 md:px-10 md:py-14">
        <header className="border-b border-border pb-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className="h-2.5 w-2.5 rounded-full"
                style={{
                  background: tab === "live" ? "var(--status-anomaly)" : "var(--status-stable)",
                  boxShadow: `0 0 12px ${tab === "live" ? "var(--status-anomaly)" : "var(--status-stable)"}`,
                }}
              />
              <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                MIG-WeldSight AI · Industrial Monitoring · {tabLabel(tab, streamStatus)}
              </span>
            </div>
            <button
              onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs uppercase tracking-wider text-muted-foreground hover:bg-accent"
            >
              {theme === "dark" ? "Light" : "Dark"}
            </button>
          </div>
          <h1 className="mt-4 text-4xl font-normal tracking-tight md:text-5xl">MIG-WeldSight AI</h1>
          <p className="mt-3 text-lg italic text-muted-foreground">
            Material- and thickness-aware welding intelligence — every anomaly explained, every event traceable.
          </p>
        </header>

        {/* Process Setup */}
        <div className="mt-8">
          <ProcessSetupPanel setup={setup} onChange={setSetup} profile={profile} />
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="mt-8">
          <TabsList className="bg-card">
            <TabsTrigger value="upload">Upload Analysis</TabsTrigger>
            <TabsTrigger value="live">Live Monitoring</TabsTrigger>
            <TabsTrigger value="training">Training & Calibration</TabsTrigger>
            <TabsTrigger value="history">Historical Analytics</TabsTrigger>
          </TabsList>

          {/* UPLOAD */}
          <TabsContent value="upload" className="mt-6 space-y-6">
            <section className="rounded-2xl border border-border bg-card p-8 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.6)]">
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-2xl">Upload Raw MIG Voltage CSV</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    The capture is processed against the active{" "}
                    <span className="italic">{setup.material} · {setup.thickness_mm} mm</span> profile.
                    Physics events, weld quality, and traceability records populate below.
                  </p>
                  {fileName && <p className="mt-3 text-sm italic">Selected: {fileName}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer rounded-lg border border-border bg-secondary px-5 py-2.5 text-sm hover:bg-accent">
                    Choose File
                    <input type="file" accept=".csv" data-csv className="hidden" onChange={(e) => onChooseFile(e.target.files?.[0] ?? null)} />
                  </label>
                  <button
                    onClick={runUploadInference}
                    disabled={loading}
                    className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
                  >
                    {loading ? "Analyzing…" : "Run Analysis"}
                  </button>
                </div>
              </div>
            </section>

            {hasData && <DashboardBody />}
          </TabsContent>

          {/* LIVE */}
          <TabsContent value="live" className="mt-6 space-y-6">
            <section className="rounded-2xl border border-border bg-card p-8 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.6)]">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl">Live Monitoring · ESP32 Stream</h2>
                <span className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{liveBanner(streamStatus)}</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Hardware streams raw voltage + distance to the backend, which performs feature extraction,
                dynamic thresholding (learned <code>k</code>), physics classification, and PCA/DBSCAN.
                The frontend renders the resulting frames.
              </p>
            </section>

            {hasData ? <DashboardBody /> : (
              <div className="rounded-2xl border border-dashed border-border/70 bg-card p-12 text-center text-sm italic text-muted-foreground">
                Awaiting first window from <code>{import.meta.env.VITE_WS_URL ?? "ws://localhost:8000/ws/live"}</code>…
              </div>
            )}
          </TabsContent>

          {/* TRAINING */}
          <TabsContent value="training" className="mt-6">
            <TrainingPanel
              setup={setup}
              onProfileLearned={(p) => {
                saveProfile(p);
                setProfile(p);
              }}
            />
          </TabsContent>

          {/* HISTORY */}
          <TabsContent value="history" className="mt-6">
            <HistoricalAnalytics events={history} />
          </TabsContent>
        </Tabs>

        <footer className="mt-12 border-t border-border pt-6 text-center text-xs italic text-muted-foreground">
          MIG-WeldSight AI · Industrial Intelligence Platform · Backend: FastAPI / Railway · Hardware: ESP32 + ADS1115
        </footer>
      </div>
    </div>
  );

  function DashboardBody() {
    return (
      <>
        {/* KPIs */}
        <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <KPI label="Windows Processed" value={stats.windows} />
          <KPI label="Anomalies Found" value={stats.anomalies} accent={stats.anomalies > 0} />
          <KPI label="Adaptive Threshold" value={stats.threshold.toFixed(2)} sub={profile ? `k=${profile.learned_k.toFixed(2)}` : "untrained"} />
          <QualityIndexCard value={quality.value} band={quality.band} />
        </section>

        {/* Raw Voltage */}
        <RawVoltageChart data={rawVoltage} />

        {/* AI Process Health */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.6)]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl">AI Process Health</h2>
            <div className="flex items-center gap-4 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <span className="flex items-center gap-2"><span className="h-2 w-4 rounded-sm" style={{ background: "var(--foreground)" }} /> Score</span>
              <span className="flex items-center gap-2"><span className="h-2 w-4 rounded-sm" style={{ background: "var(--status-warning)" }} /> Threshold</span>
              <span className="flex items-center gap-2"><span className="h-2 w-4 rounded-sm" style={{ background: "var(--status-anomaly)", opacity: 0.4 }} /> Severity</span>
            </div>
          </div>
          <div className="h-[340px] w-full">
            <ResponsiveContainer>
              <LineChart data={rolling} margin={{ top: 10, right: 20, bottom: 40, left: 10 }}>
                <CartesianGrid stroke="var(--border)" strokeOpacity={0.35} strokeDasharray="2 4" />
                <XAxis dataKey="distance" type="number" domain={["dataMin", "dataMax"]} stroke="var(--muted-foreground)" tick={{ fontSize: 11 }} label={{ value: "Distance (mm)", position: "insideBottom", offset: -28, fill: "var(--muted-foreground)" }} />
                <YAxis stroke="var(--muted-foreground)" tick={{ fontSize: 11 }} label={{ value: "Anomaly Score", angle: -90, position: "insideLeft", fill: "var(--muted-foreground)" }} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", fontFamily: "var(--font-serif)" }} />
                {anomalyRegions.map((r, i) => (
                  <ReferenceArea key={i} x1={r.x1} x2={r.x2} fill="var(--status-anomaly)" fillOpacity={0.16} stroke="var(--status-anomaly)" strokeOpacity={0.3} />
                ))}
                <Line type="monotone" dataKey="threshold" name="Adaptive Threshold" stroke="var(--status-warning)" strokeDasharray="6 4" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                <Line
                  type="monotone"
                  dataKey="score"
                  name="Anomaly Score"
                  stroke="var(--foreground)"
                  strokeWidth={1.5}
                  dot={(props: { cx?: number; cy?: number; payload?: { colour?: string; severity?: string } }) => {
                    const { cx, cy, payload } = props;
                    if (cx == null || cy == null || !payload || payload.severity === "NORMAL") return <g />;
                    return <circle cx={cx} cy={cy} r={3.5} fill={payload.colour ?? "var(--status-anomaly)"} stroke="var(--background)" strokeWidth={1} />;
                  }}
                  isAnimationActive={tab !== "live"}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Physics Events Timeline */}
        <PhysicsEventsTimeline events={enriched.map((e) => ({ distance_mm: e.distance_mm, physics: e.physics }))} />

        {/* Physics Insight */}
        <PhysicsInsightPanel latest={latestPhysics} material={setup.material} thickness_mm={setup.thickness_mm} />

        {/* Recent Events Table */}
        <RecentEventsTable
          rows={enriched.map((e) => ({
            timestamp: e.timestamp ?? Date.now(),
            distance_mm: e.distance_mm,
            voltage: e.voltage ?? 0,
            score: e.score,
            threshold: e.thresholdValue,
            quality: e.quality,
            physics: e.physics,
            status: e.status,
          }))}
        />

        {/* PCA / DBSCAN — unchanged */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.6)]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl">Process State Separation</h2>
              <span className="text-xs uppercase tracking-[0.22em] text-muted-foreground">PCA · DBSCAN</span>
            </div>
            <div className="h-[340px] w-full">
              {clusterResult ? (
                <ResponsiveContainer>
                  <ScatterChart margin={{ top: 10, right: 20, bottom: 50, left: 10 }}>
                    <CartesianGrid stroke="var(--border)" strokeOpacity={0.35} strokeDasharray="2 4" />
                    <XAxis type="number" dataKey="embedding_x" name="PC1" stroke="var(--muted-foreground)" tick={{ fontSize: 11 }} label={{ value: "embedding · PC1", position: "insideBottom", offset: -36, fill: "var(--muted-foreground)" }} />
                    <YAxis type="number" dataKey="embedding_y" name="PC2" stroke="var(--muted-foreground)" tick={{ fontSize: 11 }} label={{ value: "embedding · PC2", angle: -90, position: "insideLeft", fill: "var(--muted-foreground)" }} />
                    <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} />
                    <Legend verticalAlign="top" height={32} wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }} />
                    <Scatter name="Normal Cluster" data={scatterGroups.normal} fill="var(--status-stable)" />
                    <Scatter name="Anomaly / Outlier" data={scatterGroups.outlier} fill="var(--status-anomaly)" shape="cross" />
                  </ScatterChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm italic text-muted-foreground">
                  Need at least 6 windows to project the cluster space.
                </div>
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.6)]">
            <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Cluster State</div>
            <div className="mt-6 space-y-5">
              <Row label="Clusters" value={clusterResult?.clusters ?? 0} />
              <Row label="Outliers" value={clusterResult?.noise ?? 0} accent />
              <Row label="Density Points" value={clusterResult ? points.length - clusterResult.noise : 0} />
            </div>
          </div>
        </section>
      </>
    );
  }
}

function tabLabel(tab: Tab, status: string) {
  if (tab === "live") return `Live · ${status}`;
  if (tab === "upload") return "Upload Analysis";
  if (tab === "training") return "Training & Calibration";
  return "Historical Analytics";
}
function liveBanner(status: string) {
  if (status === "open") return "Connected · backend WebSocket";
  if (status === "simulated") return "Simulated stream — no backend detected";
  if (status === "connecting") return "Connecting…";
  if (status === "closed") return "Disconnected";
  return "Idle";
}

function KPI({ label, value, accent, sub }: { label: string; value: number | string; accent?: boolean; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.6)]">
      <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{label}</div>
      <div className="mt-3 text-4xl tabular-nums" style={{ color: accent ? "var(--status-anomaly)" : "var(--foreground)" }}>
        {value}
      </div>
      {sub && <div className="mt-1 text-xs italic text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between border-b border-border/60 pb-3 last:border-none last:pb-0">
      <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
      <span className="text-2xl tabular-nums" style={{ color: accent ? "var(--status-anomaly)" : "var(--foreground)" }}>
        {value}
      </span>
    </div>
  );
}