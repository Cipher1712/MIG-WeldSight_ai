import type { BackendFrame } from "@/lib/apiClient";

export type WindowPoint = {
  distance_mm?: number;
  score?: number;
  status?: "Stable" | "Anomaly";
  class?: "Healthy Arc" | "Arc Instability" | "Spatter Risk" | "Burn Through Risk" | "Low Heat Input Risk";
  embedding_x?: number;
  embedding_y?: number;
  threshold?: number;
  voltage?: number;
  arc_on?: boolean;
  timestamp?: number;
  quality_index?: number;
  prediction?: BackendFrame["prediction"];
  severity?: string;
  physics_label?: string;
  ml_label?: string;
  confidence?: number;
  diagnosis?: string;
  recommendation?: string;
  arc_instability_score?: number;
  spatter_risk_score?: number;
  burn_through_risk_score?: number;
  low_heat_input_score?: number;
  display_label?: string;
  possible_causes?: string[];
  recommended_actions?: string[];
  top_contributors?: BackendFrame["top_contributors"];
  top_features?: BackendFrame["top_features"];
  quality_breakdown?: BackendFrame["quality_breakdown"];
  voltage_features?: BackendFrame["voltage_features"];
};

export function mapBackendFrame(frame: BackendFrame, embedding?: number[]): WindowPoint {
  const severity = frame.severity;
  const display = frame.display_label ?? frame.prediction ?? labelFromPhysics(frame.physics_label);
  return {
    distance_mm: numberOrUndefined(frame.distance_mm),
    score: numberOrUndefined(frame.anomaly_score),
    status: severity ? (severity === "NORMAL" ? "Stable" : "Anomaly") : undefined,
    class: display ? classFromLabel(display, frame.physics_label) : undefined,
    embedding_x: numberOrUndefined(embedding?.[0] ?? frame.embedding_x),
    embedding_y: numberOrUndefined(embedding?.[1] ?? frame.embedding_y),
    threshold: numberOrUndefined(frame.threshold ?? frame.anomaly_threshold),
    voltage: numberOrUndefined(frame.voltage ?? frame.voltage_features?.mean_v),
    timestamp: normalizeTimestamp(frame.timestamp),
    quality_index: numberOrUndefined(frame.quality_index ?? frame.quality_score),
    prediction: frame.prediction,
    severity,
    physics_label: frame.physics_label,
    ml_label: frame.ml_label,
    confidence: numberOrUndefined(frame.confidence),
    diagnosis: frame.diagnosis,
    recommendation: frame.recommendation,
    arc_instability_score: numberOrUndefined(frame.arc_instability_score),
    spatter_risk_score: numberOrUndefined(frame.spatter_risk_score),
    burn_through_risk_score: numberOrUndefined(frame.burn_through_risk_score),
    low_heat_input_score: numberOrUndefined(frame.low_heat_input_score),
    display_label: display,
    possible_causes: frame.possible_causes,
    recommended_actions: frame.recommended_actions,
    top_contributors: frame.top_contributors,
    top_features: frame.top_features,
    quality_breakdown: frame.quality_breakdown,
    voltage_features: frame.voltage_features,
  };
}

export async function parseCsvVoltage(file: File): Promise<{ voltage: number[]; distance?: number[] }> {
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length);
  if (!lines.length) return { voltage: [] };
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const voltageIdx = header.findIndex((h) =>
    ["migvoltage", "mig voltage", "voltage", "arcvoltage", "voltage_v", "migvolatge"].some((name) =>
      h.replace(/[_\s]/g, "").includes(name.replace(/[_\s]/g, "")),
    ),
  );
  const distIdx = header.findIndex((h) => h.includes("distance"));
  const voltage: number[] = [];
  const distance: number[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const v = Number(cols[voltageIdx]);
    const d = distIdx >= 0 ? Number(cols[distIdx]) : undefined;
    if (!Number.isFinite(v)) continue;
    voltage.push(v);
    if (typeof d === "number" && Number.isFinite(d)) distance.push(d);
  }
  return { voltage, distance: distance.length === voltage.length ? distance : undefined };
}

// DBSCAN on 2D embedding (NOT distance). label -1 = anomaly/outlier.
export function dbscan2d(points: { embedding_x: number; embedding_y: number }[], eps = 0.7, minPts = 4) {
  const labels = new Array(points.length).fill(-2);
  const dist = (i: number, j: number) =>
    Math.hypot(points[i].embedding_x - points[j].embedding_x, points[i].embedding_y - points[j].embedding_y);
  const neighbors = (i: number) => {
    const out: number[] = [];
    for (let j = 0; j < points.length; j++) if (i !== j && dist(i, j) <= eps) out.push(j);
    return out;
  };
  let c = 0;
  for (let i = 0; i < points.length; i++) {
    if (labels[i] !== -2) continue;
    const n = neighbors(i);
    if (n.length < minPts) { labels[i] = -1; continue; }
    labels[i] = c;
    const queue = [...n];
    while (queue.length) {
      const q = queue.shift()!;
      if (labels[q] === -1) labels[q] = c;
      if (labels[q] !== -2) continue;
      labels[q] = c;
      const qn = neighbors(q);
      if (qn.length >= minPts) queue.push(...qn);
    }
    c++;
  }
  return { labels, clusters: c, noise: labels.filter((l) => l === -1).length };
}

function normalizeTimestamp(ts: BackendFrame["timestamp"]) {
  if (typeof ts === "number") return ts < 10_000_000_000 ? ts * 1000 : ts;
  if (typeof ts === "string") return new Date(ts).getTime();
  return undefined;
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

function classFromLabel(display: string, label?: string): WindowPoint["class"] {
  const text = `${display} ${label ?? ""}`.toLowerCase();
  if (text.includes("burn")) return "Burn Through Risk";
  if (text.includes("heat") || text.includes("cold")) return "Low Heat Input Risk";
  if (text.includes("spatter") || text.includes("transfer")) return "Spatter Risk";
  if (text.includes("instability") || text.includes("unstable")) return "Arc Instability";
  if (text.includes("healthy") || text.includes("arc")) return "Healthy Arc";
  return undefined;
}
