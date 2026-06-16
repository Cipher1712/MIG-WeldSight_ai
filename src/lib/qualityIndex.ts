// Weld Quality Index. Scored 0-100 from four weighted axes per spec.
// Pure presentation logic — backend will compute the canonical value
// once deployed; frontend uses identical math as fallback so Live and
// Upload modes agree when running against the sim.

export interface QualityInputs {
  std_v: number;          // electrical stability
  sc_count: number;       // transfer stability (lower = better, expected ~2)
  crest_factor: number;   // arc consistency (expected ~1.1)
  score: number;          // current anomaly score
  ewma: number;           // process drift reference
}

export type QualityBand = "Excellent" | "Good" | "Monitor" | "Poor";

export function computeQualityIndex(q: QualityInputs): { value: number; band: QualityBand } {
  const electrical = clamp01(1 - Math.min(q.std_v, 3) / 3) * 100;          // 40%
  const transfer = clamp01(1 - Math.min(Math.abs(q.sc_count - 2), 6) / 6) * 100; // 30%
  const arc = clamp01(1 - Math.min(Math.abs(q.crest_factor - 1.1), 0.5) / 0.5) * 100; // 20%
  const drift = clamp01(1 - Math.min(Math.abs(q.score - q.ewma), 4) / 4) * 100; // 10%
  const value = Math.round(0.4 * electrical + 0.3 * transfer + 0.2 * arc + 0.1 * drift);
  const band: QualityBand =
    value >= 85 ? "Excellent" : value >= 70 ? "Good" : value >= 50 ? "Monitor" : "Poor";
  return { value, band };
}

export function bandColour(b: QualityBand): string {
  switch (b) {
    case "Excellent":
      return "var(--status-stable)";
    case "Good":
      return "var(--tag-blue)";
    case "Monitor":
      return "var(--status-warning)";
    case "Poor":
      return "var(--status-anomaly)";
  }
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}