// Weld Quality Index presentation helpers. The numeric index itself must come
// from backend telemetry.

export type QualityBand = "Excellent" | "Good" | "Monitor" | "Poor";

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
