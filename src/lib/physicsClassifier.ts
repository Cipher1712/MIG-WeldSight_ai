// Physics-aware classifier for MIG voltage windows. Maps raw window
// statistics into a severity tier with a human-readable explanation.
// Severity tiers are colour-coded in the UI.

export type Severity = "NORMAL" | "INFO" | "WARNING" | "CRITICAL";

export interface WindowFeatures {
  mean_v: number;
  std_v: number;
  min_v: number;
  max_v: number;
  sc_count: number;      // short-circuit transition count
  crest_factor: number;  // peak / rms
}

export interface PhysicsResult {
  severity: Severity;
  display_label: string;
  physics_label: string;
  physics_text: string;
  colour: string;          // CSS var
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

/**
 * Derive physics-style features from a single score + its neighbours.
 * Real systems read raw voltage samples; here we synthesise consistent
 * features from the score so the UI is meaningful in both modes.
 */
export function deriveFeatures(score: number, prevScore = 0, idx = 0): WindowFeatures {
  const noise = (Math.sin(idx * 1.7) + 1) / 2; // 0..1 deterministic
  const mean_v = 19.2 + score * 0.35 + noise * 0.4;
  const std_v = 0.4 + score * 0.22 + Math.abs(score - prevScore) * 0.1;
  const min_v = mean_v - 2.4 - std_v * 1.6;
  const max_v = mean_v + 2.8 + std_v * 1.9 + (score > 4 ? 1.2 : 0);
  const sc_count = Math.max(0, Math.round(score * 1.4 + noise * 2));
  const rms = Math.sqrt(mean_v * mean_v + std_v * std_v);
  const crest_factor = +(max_v / Math.max(rms, 1e-3)).toFixed(3);
  return {
    mean_v: +mean_v.toFixed(3),
    std_v: +std_v.toFixed(3),
    min_v: +min_v.toFixed(3),
    max_v: +max_v.toFixed(3),
    sc_count,
    crest_factor,
  };
}

export function classifyWindow(
  score: number,
  threshold: number,
  features: WindowFeatures,
  ctx: { material?: string; thickness_mm?: number } = {},
): PhysicsResult {
  const ratio = score / Math.max(threshold, 1e-3);

  let severity: Severity = "NORMAL";
  let physics_label = "stable_arc";
  let display_label = "Stable Arc";
  let physics_text = "Window within normal operating envelope. Mean voltage, deviation, and short-circuit cadence all nominal.";
  let possible_causes: string[] = [];
  let recommended_actions: string[] = [];

  if (ratio >= 1.8 || features.crest_factor > 1.35) {
    severity = "CRITICAL";
    physics_label = "short_circuit_abnormality";
    display_label = "Short-Circuit Abnormality";
    physics_text = `Crest factor ${features.crest_factor} and short-circuit count ${features.sc_count} exceed safe envelope. Wire feed or contact tip distance likely compromised.`;
    possible_causes = [
      "Excessive contact-tip-to-work distance (CTWD)",
      "Wire feeder slippage or worn liner",
      "Insufficient shielding gas flow",
    ];
    recommended_actions = [
      "Reduce CTWD to within 10–15 mm",
      "Inspect wire liner, drive rolls and tension",
      "Verify gas flow ≥ 12 L/min and check for leaks",
    ];
  } else if (ratio >= 1.25 || features.std_v > 1.6) {
    severity = "WARNING";
    physics_label = "arc_instability";
    display_label = "Arc Instability";
    physics_text = `Voltage deviation σ=${features.std_v} is high relative to mean. Indicates erratic arc length — check shielding gas flow and travel speed.`;
    possible_causes = [
      "Magnetic arc blow on " + (ctx.material ?? "workpiece"),
      "Contaminated workpiece surface (mill scale, oil)",
      "Inconsistent torch angle / travel speed",
    ];
    recommended_actions = [
      "Verify grounding clamp placement",
      "Clean workpiece with wire brush / solvent",
      "Stabilise torch angle at 10–15° drag",
    ];
  } else if (ratio >= 0.95) {
    severity = "INFO";
    physics_label = "transfer_change";
    display_label = "Transfer Mode Change";
    physics_text = `Score approaches threshold (${score.toFixed(2)} / ${threshold.toFixed(2)}). Metal-transfer regime may be shifting (spray ↔ globular).`;
    possible_causes = [
      "Voltage drift across the joint",
      `Thickness change (set: ${ctx.thickness_mm ?? "?"} mm)`,
      "Wire feed speed approaching transition band",
    ];
    recommended_actions = [
      "Confirm voltage setpoint matches material/thickness",
      "Check WFS calibration",
      "Review joint preparation for thickness variation",
    ];
  }

  return {
    severity,
    display_label,
    physics_label,
    physics_text,
    colour: SEVERITY_COLOUR[severity],
    features,
    possible_causes,
    recommended_actions,
  };
}