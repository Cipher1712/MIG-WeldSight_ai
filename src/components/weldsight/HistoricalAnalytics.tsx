import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SEVERITY_COLOUR, type Severity } from "@/lib/physicsClassifier";

export interface HistoryEvent {
  timestamp: number;
  material: string;
  thickness_mm: number;
  severity: Severity;
  quality?: number;
  score?: number;
}

export function HistoricalAnalytics({ events }: { events: HistoryEvent[] }) {
  const severityCounts = useMemo(() => {
    const tally: Record<Severity, number> = { NORMAL: 0, INFO: 0, WARNING: 0, CRITICAL: 0 };
    events.forEach((e) => (tally[e.severity] += 1));
    return (Object.keys(tally) as Severity[]).map((k) => ({ severity: k, count: tally[k] }));
  }, [events]);

  const trend = useMemo(() => {
    const buckets: Record<string, { day: string; quality: number; n: number; anomalies: number }> = {};
    events.forEach((e) => {
      if (typeof e.quality !== "number") return;
      const day = new Date(e.timestamp).toISOString().slice(0, 10);
      const b = (buckets[day] ??= { day, quality: 0, n: 0, anomalies: 0 });
      b.quality += e.quality;
      b.n += 1;
      if (e.severity !== "NORMAL") b.anomalies += 1;
    });
    return Object.values(buckets)
      .map((b) => ({ day: b.day, quality: Math.round(b.quality / b.n), anomalyRate: Math.round((b.anomalies / b.n) * 100) }))
      .sort((a, b) => a.day.localeCompare(b.day));
  }, [events]);

  const qualityEvents = useMemo(() => events.filter((e) => typeof e.quality === "number"), [events]);

  const perMaterial = useMemo(() => {
    const grp: Record<string, { key: string; anomalies: number; total: number }> = {};
    events.forEach((e) => {
      const k = `${e.material} | ${e.thickness_mm}mm`;
      const g = (grp[k] ??= { key: k, anomalies: 0, total: 0 });
      g.total += 1;
      if (e.severity !== "NORMAL") g.anomalies += 1;
    });
    return Object.values(grp).map((g) => ({ key: g.key, rate: Math.round((g.anomalies / g.total) * 100) }));
  }, [events]);

  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 bg-card p-12 text-center text-sm italic text-muted-foreground">
        No historical events yet. Run Upload Analysis or Live Monitoring to populate the traceability log.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Stat label="Total Events" value={events.length} />
        <Stat label="Anomaly Rate" value={`${pct(events.filter((e) => e.severity !== "NORMAL").length, events.length)}%`} />
        <Stat
          label="Avg Quality"
          value={qualityEvents.length ? Math.round(qualityEvents.reduce((s, e) => s + e.quality!, 0) / qualityEvents.length) : "--"}
        />
      </div>

      {trend.length ? (
        <Card title="Quality Index Trend">
          <div className="h-[220px]">
            <ResponsiveContainer>
              <LineChart data={trend} margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeOpacity={0.35} strokeDasharray="2 4" />
                <XAxis dataKey="day" stroke="var(--muted-foreground)" tick={{ fontSize: 11 }} />
                <YAxis stroke="var(--muted-foreground)" tick={{ fontSize: 11 }} domain={[0, 100]} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} />
                <Line type="monotone" dataKey="quality" stroke="var(--status-stable)" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="anomalyRate" stroke="var(--status-anomaly)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      ) : (
        <div className="rounded-2xl border border-dashed border-border/70 bg-card p-12 text-center text-sm italic text-muted-foreground">
          No live quality telemetry available for trend charts.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Severity Breakdown">
          <div className="h-[220px]">
            <ResponsiveContainer>
              <BarChart data={severityCounts}>
                <CartesianGrid stroke="var(--border)" strokeOpacity={0.35} strokeDasharray="2 4" />
                <XAxis dataKey="severity" stroke="var(--muted-foreground)" tick={{ fontSize: 11 }} />
                <YAxis stroke="var(--muted-foreground)" tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {severityCounts.map((c) => (
                    <Cell key={c.severity} fill={SEVERITY_COLOUR[c.severity]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Anomaly Rate | Material x Thickness">
          <div className="h-[220px]">
            <ResponsiveContainer>
              <BarChart data={perMaterial}>
                <CartesianGrid stroke="var(--border)" strokeOpacity={0.35} strokeDasharray="2 4" />
                <XAxis dataKey="key" stroke="var(--muted-foreground)" tick={{ fontSize: 10 }} />
                <YAxis stroke="var(--muted-foreground)" tick={{ fontSize: 11 }} unit="%" />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} />
                <Bar dataKey="rate" fill="var(--status-warning)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.6)]">
      <h3 className="mb-4 text-lg">{title}</h3>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-3xl tabular-nums">{value}</div>
    </div>
  );
}

function pct(n: number, d: number) {
  return d ? Math.round((n / d) * 100) : 0;
}
