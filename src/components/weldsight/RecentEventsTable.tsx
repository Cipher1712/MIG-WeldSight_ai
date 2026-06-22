import { AnimatePresence, motion } from "framer-motion";
import type { PhysicsResult } from "@/lib/physicsClassifier";

export interface EventRow {
  timestamp?: number;
  distance_mm?: number;
  voltage?: number;
  score?: number;
  threshold?: number;
  quality?: number;
  physics: PhysicsResult | null;
  status?: "Stable" | "Anomaly";
}

export function RecentEventsTable({ rows }: { rows: EventRow[] }) {
  if (!rows.length) return null;
  const recent = rows.slice(-14).reverse();
  return (
    <section className="mt-8 overflow-hidden rounded-2xl border border-border bg-card shadow-[0_8px_32px_-12px_rgba(0,0,0,0.6)]">
      <div className="border-b border-border px-6 py-4 text-xs uppercase tracking-[0.22em] text-muted-foreground">
        Recent Events
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              <Th>Time</Th>
              <Th>Distance</Th>
              <Th>Voltage</Th>
              <Th>Physics</Th>
              <Th>Severity</Th>
              <Th>Threshold</Th>
              <Th>Quality</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            <AnimatePresence initial={false}>
              {recent.map((r, i) => (
                <motion.tr
                  key={`${r.timestamp}-${i}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  style={{
                    background:
                      r.physics?.severity === "CRITICAL"
                        ? "color-mix(in oklab, var(--status-anomaly) 8%, transparent)"
                        : r.physics?.severity === "WARNING"
                          ? "color-mix(in oklab, var(--status-warning) 6%, transparent)"
                          : undefined,
                  }}
                >
                  <Td muted>{formatClock(r.timestamp)}</Td>
                  <Td>{formatNumber(r.distance_mm, "mm")}</Td>
                  <Td>{formatNumber(r.voltage, "V")}</Td>
                  <Td>
                    {r.physics ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ background: r.physics.colour, boxShadow: `0 0 8px ${r.physics.colour}` }} />
                        <span style={{ color: r.physics.colour }}>{r.physics.display_label}</span>
                      </span>
                    ) : "--"}
                  </Td>
                  <Td>
                    {r.physics ? (
                      <span className="text-[10px] uppercase tracking-[0.18em]" style={{ color: r.physics.colour }}>
                        {r.physics.severity}
                      </span>
                    ) : "--"}
                  </Td>
                  <Td style={{ color: "var(--status-warning)" }}>{formatNumber(r.threshold)}</Td>
                  <Td>{typeof r.quality === "number" ? r.quality : "--"}</Td>
                  <Td>
                    <span style={{ color: r.status === "Anomaly" ? "var(--status-anomaly)" : r.status === "Stable" ? "var(--status-stable)" : undefined }}>
                      {r.status ?? "--"}
                    </span>
                  </Td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 font-normal">{children}</th>;
}
function Td({ children, muted, style }: { children: React.ReactNode; muted?: boolean; style?: React.CSSProperties }) {
  return (
    <td className="px-4 py-3 tabular-nums" style={{ color: muted ? "var(--muted-foreground)" : undefined, ...style }}>
      {children}
    </td>
  );
}

function formatClock(ts?: number) {
  if (typeof ts !== "number") return "--";
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour12: false });
}

function formatNumber(value?: number, unit?: string) {
  if (typeof value !== "number") return "--";
  return `${value.toFixed(2)}${unit ? ` ${unit}` : ""}`;
}
