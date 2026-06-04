import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

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

const SEED: Row[] = [
  { distance: 23.7, score: 0.32, status: "Stable", classification: "Normal" },
  { distance: 56.8, score: 1.12, status: "Stable", classification: "Normal" },
  { distance: 88.3, score: 4.85, status: "Anomaly", classification: "Arc Instability" },
  { distance: 117.4, score: 8.21, status: "Anomaly", classification: "Transfer Change" },
  { distance: 143.0, score: 12.7, status: "Anomaly", classification: "Short Circuit Abnormality" },
];

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
          <div className="flex items-center gap-3">
            <div className="h-2.5 w-2.5 rounded-full bg-[var(--status-stable)] shadow-[0_0_12px_var(--status-stable)]" />
            <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
              WeldSight AI · System Online
            </span>
          </div>
          <h1 className="mt-4 text-4xl font-normal tracking-tight md:text-5xl">
            WeldSight AI — Welding Anomaly Monitoring
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
