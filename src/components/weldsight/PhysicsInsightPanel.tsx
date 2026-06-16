import { SEVERITY_COLOUR, type PhysicsResult } from "@/lib/physicsClassifier";
import { MATERIALS, type MaterialKey, type ThicknessMm } from "@/lib/profiles";

export function PhysicsInsightPanel({
  latest,
  material,
  thickness_mm,
}: {
  latest: PhysicsResult | null;
  material: MaterialKey;
  thickness_mm: ThicknessMm;
}) {
  const isNormal = !latest || latest.severity === "NORMAL";
  const colour = latest ? latest.colour : SEVERITY_COLOUR.NORMAL;
  const materialLabel = MATERIALS.find((m) => m.key === material)?.label ?? material;

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.6)]">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl">Physics Insight</h2>
        <span className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
          {materialLabel} · {thickness_mm} mm
        </span>
      </div>

      {isNormal ? (
        <div className="mt-5 flex items-center gap-3 rounded-xl border border-border bg-background/40 px-4 py-4">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: SEVERITY_COLOUR.NORMAL, boxShadow: `0 0 12px ${SEVERITY_COLOUR.NORMAL}` }} />
          <span className="text-sm italic text-muted-foreground">
            All windows within normal operating envelope.
          </span>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <div className="flex items-center gap-3">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: colour, boxShadow: `0 0 12px ${colour}` }} />
            <span className="text-lg" style={{ color: colour }}>{latest!.display_label}</span>
            <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              {latest!.severity}
            </span>
          </div>
          <p className="text-sm italic leading-relaxed text-muted-foreground">
            {latest!.physics_text}
          </p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <FeatureCell label="mean_v" value={latest!.features.mean_v} unit="V" />
            <FeatureCell label="std_v" value={latest!.features.std_v} unit="V" />
            <FeatureCell label="min_v" value={latest!.features.min_v} unit="V" />
            <FeatureCell label="max_v" value={latest!.features.max_v} unit="V" />
            <FeatureCell label="sc_count" value={latest!.features.sc_count} />
            <FeatureCell label="crest_factor" value={latest!.features.crest_factor} />
          </div>

          {(latest!.possible_causes.length > 0 || latest!.recommended_actions.length > 0) && (
            <div className="grid grid-cols-1 gap-4 pt-2 md:grid-cols-2">
              <CauseList title="Possible Causes" items={latest!.possible_causes} colour={colour} />
              <CauseList title="Recommended Actions" items={latest!.recommended_actions} colour="var(--status-stable)" />
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function FeatureCell({ label, value, unit }: { label: string; value: number; unit?: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/30 px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg tabular-nums">
        {typeof value === "number" ? value.toFixed(value % 1 === 0 ? 0 : 2) : value}
        {unit && <span className="ml-1 text-xs text-muted-foreground">{unit}</span>}
      </div>
    </div>
  );
}

function CauseList({ title, items, colour }: { title: string; items: string[]; colour: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/30 px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{title}</div>
      <ul className="mt-2 space-y-1.5 text-sm">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-2 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: colour }} />
            <span className="text-muted-foreground">{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}