import { MATERIAL_PRESETS, type MaterialKey } from "@/lib/dynamicThreshold";

export function MaterialSelector({
  value,
  onChange,
}: {
  value: MaterialKey;
  onChange: (m: MaterialKey) => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.6)]">
      <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Material</div>
      <div className="mt-3 inline-flex rounded-lg border border-border bg-background/40 p-1">
        {(Object.keys(MATERIAL_PRESETS) as MaterialKey[]).map((k) => (
          <button
            key={k}
            onClick={() => onChange(k)}
            className={`rounded-md px-3 py-1.5 text-xs uppercase tracking-wider transition-colors ${
              value === k
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {MATERIAL_PRESETS[k].label}
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs italic leading-relaxed text-muted-foreground">
        {MATERIAL_PRESETS[value].description}
      </p>
    </div>
  );
}