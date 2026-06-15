export function SensitivitySlider({
  value,
  onChange,
  min = 1.5,
  max = 5.0,
  step = 0.1,
}: {
  value: number;
  onChange: (k: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.6)]">
      <div className="flex items-baseline justify-between">
        <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Sensitivity · k</div>
        <div className="text-2xl tabular-nums">{value.toFixed(1)}</div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-4 w-full accent-[var(--status-warning)]"
        aria-label="Sensitivity multiplier"
      />
      <div className="mt-1 flex justify-between text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        <span>Permissive {min}</span>
        <span>Strict {max}</span>
      </div>
    </div>
  );
}