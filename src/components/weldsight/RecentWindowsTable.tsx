import { AnimatePresence, motion } from "framer-motion";
import type { PhysicsResult } from "@/lib/physicsClassifier";

export interface EnrichedRow {
  distance_mm: number;
  score: number;
  threshold: number;
  physics: PhysicsResult;
}

export function RecentWindowsTable({ rows }: { rows: EnrichedRow[] }) {
  if (!rows.length) return null;
  const recent = rows.slice(-12).reverse();
  return (
    <section className="mt-8 overflow-hidden rounded-2xl border border-border bg-card shadow-[0_8px_32px_-12px_rgba(0,0,0,0.6)]">
      <div className="border-b border-border px-6 py-4 text-xs uppercase tracking-[0.22em] text-muted-foreground">
        Recent Windows
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              <th className="px-6 py-3 font-normal">Distance</th>
              <th className="px-6 py-3 font-normal">Score</th>
              <th className="px-6 py-3 font-normal">Physics</th>
              <th className="px-6 py-3 font-normal">Threshold</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            <AnimatePresence initial={false}>
              {recent.map((r, i) => (
                <motion.tr
                  key={`${r.distance_mm}-${i}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <td className="px-6 py-3 tabular-nums text-muted-foreground">{r.distance_mm.toFixed(2)} mm</td>
                  <td className="px-6 py-3 tabular-nums">{r.score.toFixed(3)}</td>
                  <td className="px-6 py-3">
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: r.physics.colour, boxShadow: `0 0 8px ${r.physics.colour}` }}
                      />
                      <span style={{ color: r.physics.colour }}>{r.physics.display_label}</span>
                    </span>
                  </td>
                  <td className="px-6 py-3 tabular-nums" style={{ color: "var(--status-warning)" }}>
                    {r.threshold.toFixed(2)}
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    </section>
  );
}