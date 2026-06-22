import { bandColour, type QualityBand } from "@/lib/qualityIndex";

export function QualityIndexCard({ value, band }: { value?: number; band?: QualityBand }) {
  const colour = band ? bandColour(band) : "var(--muted-foreground)";
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.6)]">
      <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Weld Quality Index</div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-4xl tabular-nums" style={{ color: colour }}>
          {typeof value === "number" ? value : "--"}
        </span>
        {typeof value === "number" && <span className="text-sm text-muted-foreground">/ 100</span>}
      </div>
      <div className="mt-1 text-xs italic" style={{ color: colour }}>{band ?? "No Data"}</div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-background/50">
        {typeof value === "number" && (
          <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, background: colour }} />
        )}
      </div>
    </div>
  );
}
