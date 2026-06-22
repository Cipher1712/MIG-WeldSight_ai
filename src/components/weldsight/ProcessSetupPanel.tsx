import {
  MATERIALS,
  THICKNESSES,
  type MaterialKey,
  type ProcessSetup,
  type BaselineProfile,
} from "@/lib/profiles";

export function ProcessSetupPanel({
  setup,
  onChange,
  profile,
}: {
  setup: ProcessSetup;
  onChange: (next: ProcessSetup) => void;
  profile: BaselineProfile | null;
}) {
  const trained = !!profile;
  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.6)]">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Process Setup</div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em]">
          <span
            className="h-2 w-2 rounded-full"
            style={{
              background: trained ? "var(--status-stable)" : "var(--status-warning)",
              boxShadow: `0 0 10px ${trained ? "var(--status-stable)" : "var(--status-warning)"}`,
            }}
          />
          <span style={{ color: trained ? "var(--status-stable)" : "var(--status-warning)" }}>
            {trained ? "Trained" : "Untrained"}
          </span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-4">
        <Field label="Material">
          <select
            value={setup.material}
            onChange={(e) => onChange({ ...setup, material: e.target.value as MaterialKey })}
            className="w-full rounded-md border border-border bg-background/60 px-3 py-2 text-sm"
          >
            {MATERIALS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Thickness">
          <select
            value={setup.thickness_mm}
            onChange={(e) => onChange({ ...setup, thickness_mm: Number(e.target.value) })}
            className="w-full rounded-md border border-border bg-background/60 px-3 py-2 text-sm"
          >
            {THICKNESSES.map((t) => (
              <option key={t} value={t}>
                {t} mm
              </option>
            ))}
          </select>
        </Field>

        <Field label="Samples">
          <div className="text-xl tabular-nums">
            {profile ? profile.trained_windows.toLocaleString() : "—"}
          </div>
        </Field>

        <Field label="Last Updated">
          <div className="text-sm tabular-nums text-muted-foreground">
            {profile ? formatProfileDate(profile.updated_at) : "—"}
          </div>
        </Field>
      </div>

      {profile && (
        <div className="mt-5 grid grid-cols-2 gap-3 rounded-xl border border-border bg-background/30 p-4 md:grid-cols-4">
          <Mini label="learned_k" value={profile.learned_k.toFixed(2)} />
          <Mini label="μ score" value={profile.mean_score.toFixed(2)} />
          <Mini label="V envelope" value={formatRange(profile.voltage_min, profile.voltage_max, "V")} />
          <Mini label="RMS envelope" value={formatRange(profile.rms_min, profile.rms_max, "V")} />
        </div>
      )}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{label}</div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm tabular-nums">{value}</div>
    </div>
  );
}

function formatProfileDate(value: number | string | undefined) {
  if (value == null) return "--";
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? new Date(time).toISOString().slice(0, 10) : "--";
}

function formatRange(min?: number, max?: number, unit?: string) {
  if (typeof min !== "number" || typeof max !== "number") return "--";
  return `${min.toFixed(1)}-${max.toFixed(1)}${unit ? ` ${unit}` : ""}`;
}
