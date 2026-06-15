export function ThresholdCard({
  value,
  warmup,
  k,
}: {
  value: number;
  warmup: boolean;
  k: number;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.6)]">
      <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Threshold</div>
      <div className="mt-3 text-4xl tabular-nums" style={{ color: "var(--status-warning)" }}>
        {value.toFixed(2)}
      </div>
      <div className="mt-1 text-xs italic text-muted-foreground">
        {warmup ? "static (warmup)" : `adaptive (k=${k.toFixed(1)})`}
      </div>
    </div>
  );
}