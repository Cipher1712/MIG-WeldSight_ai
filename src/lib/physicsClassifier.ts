// Physics event normalization for backend-provided MIG welding telemetry.
// The frontend does not synthesize telemetry, features, severity, or diagnoses.

export type Severity = "NORMAL" | "INFO" | "WARNING" | "CRITICAL";

export interface WindowFeatures {
  mean_v?: number;
  std_v?: number;
  min_v?: number;
  max_v?: number;
  sc_count?: number;
  crest_factor?: number;
}

export interface PhysicsResult {
  severity: Severity;
  display_label: string;
  physics_label: string;
  physics_text: string;
  colour: string;
  features: WindowFeatures;
  possible_causes: string[];
  recommended_actions: string[];
}

export const SEVERITY_COLOUR: Record<Severity, string> = {
  NORMAL: "var(--status-stable)",
  INFO: "var(--tag-blue)",
  WARNING: "var(--tag-orange)",
  CRITICAL: "var(--status-anomaly)",
};

export function physicsFromBackend(p: {
  severity?: string;
  prediction?: string;
  display_label?: string;
  physics_label?: string;
  diagnosis?: string;
  recommendation?: string;
  possible_causes?: string[];
  recommended_actions?: string[];
  voltage_features?: Partial<WindowFeatures> & { short_circuit_count?: number };
}): PhysicsResult | null {
  const severity = normalizeSeverity(p.severity);
  const displayLabel = p.display_label ?? p.prediction ?? labelFromPhysics(p.physics_label);
  const features = p.voltage_features
    ? {
        mean_v: numberOrUndefined(p.voltage_features.mean_v),
        std_v: numberOrUndefined(p.voltage_features.std_v),
        min_v: numberOrUndefined(p.voltage_features.min_v),
        max_v: numberOrUndefined(p.voltage_features.max_v),
        sc_count: numberOrUndefined(p.voltage_features.sc_count ?? p.voltage_features.short_circuit_count),
        crest_factor: numberOrUndefined(p.voltage_features.crest_factor),
      }
    : {};

  if (!severity && !displayLabel && !p.diagnosis && !p.recommendation && !p.voltage_features) return null;

  const resolvedSeverity = severity ?? "INFO";
  return {
    severity: resolvedSeverity,
    display_label: displayLabel ?? "Backend Event",
    physics_label: p.physics_label ?? "backend_event",
    physics_text: p.diagnosis ?? "Backend did not include a diagnosis for this window.",
    colour: SEVERITY_COLOUR[resolvedSeverity],
    features,
    possible_causes: p.possible_causes ?? [],
    recommended_actions: p.recommended_actions ?? (p.recommendation ? [p.recommendation] : []),
  };
}

function normalizeSeverity(value?: string): Severity | null {
  if (value === "NORMAL" || value === "INFO" || value === "WARNING" || value === "CRITICAL") return value;
  if (value === "POOR") return "WARNING";
  return null;
}

function labelFromPhysics(label?: string) {
  if (!label) return undefined;
  const normalized = label.toLowerCase();
  if (normalized.includes("healthy")) return "Healthy Arc";
  if (normalized.includes("cold") || normalized.includes("low_heat")) return "Low Heat Input Risk";
  if (normalized.includes("transfer") || normalized.includes("spatter")) return "Spatter Risk";
  if (normalized.includes("burn")) return "Burn Through Risk";
  if (normalized.includes("instability") || normalized.includes("unstable") || normalized.includes("arc")) {
    return "Arc Instability";
  }
  return undefined;
}

function numberOrUndefined(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}
