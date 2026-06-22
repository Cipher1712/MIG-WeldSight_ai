import { WS_LIVE_URL, type BackendFrame } from "@/lib/apiClient";

export type WindowPoint = {
  distance_mm?: number;
  score?: number;
  status?: "Stable" | "Anomaly";
  class?: "Normal" | "Arc Instability" | "Transfer Change" | "Short Circuit Abnormality";
  embedding_x?: number;
  embedding_y?: number;
  threshold?: number;
  voltage?: number;
  arc_on?: boolean;
  timestamp?: number;
  quality_index?: number;
  severity?: string;
  physics_label?: string;
  ml_label?: string;
  confidence?: number;
  diagnosis?: string;
  recommendation?: string;
  display_label?: string;
  possible_causes?: string[];
  recommended_actions?: string[];
  top_contributors?: BackendFrame["top_contributors"];
  top_features?: BackendFrame["top_features"];
  voltage_features?: BackendFrame["voltage_features"];
};

export type StreamHandle = {
  close: () => void;
  source: "websocket";
};

export function connectStream(
  onMessage: (p: WindowPoint) => void,
  opts?: { url?: string; onStatus?: (s: "connecting" | "open" | "closed" | "error") => void },
): StreamHandle {
  const url = opts?.url ?? WS_LIVE_URL;
  opts?.onStatus?.("connecting");
  let ws: WebSocket | null = null;
  let closed = false;

  try {
    ws = new WebSocket(url);
    const connectTimer = window.setTimeout(() => {
      if (ws && ws.readyState !== WebSocket.OPEN) {
        try { ws.close(); } catch { /* noop */ }
        if (!closed) opts?.onStatus?.("error");
      }
    }, 10_000);
    ws.onopen = () => { window.clearTimeout(connectTimer); opts?.onStatus?.("open"); };
    ws.onmessage = (ev) => {
      try {
        onMessage(mapBackendFrame(JSON.parse(ev.data) as BackendFrame));
      } catch {
        /* ignore malformed frames */
      }
    };
    ws.onerror = () => opts?.onStatus?.("error");
    ws.onclose = () => {
      window.clearTimeout(connectTimer);
      opts?.onStatus?.("closed");
    };
  } catch {
    opts?.onStatus?.("error");
  }

  return {
    source: "websocket",
    close: () => {
      closed = true;
      if (ws && ws.readyState <= 1) {
        try { ws.close(); } catch { /* noop */ }
      }
    },
  };
}

export function mapBackendFrame(frame: BackendFrame, embedding?: number[]): WindowPoint {
  const severity = frame.severity;
  const display = frame.display_label ?? labelFromPhysics(frame.physics_label);
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
    severity,
    physics_label: frame.physics_label,
    ml_label: frame.ml_label,
    confidence: frame.confidence,
    diagnosis: frame.diagnosis,
    recommendation: frame.recommendation,
    display_label: display,
    possible_causes: frame.possible_causes,
    recommended_actions: frame.recommended_actions,
    top_contributors: frame.top_contributors,
    top_features: frame.top_features,
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
  return label
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function numberOrUndefined(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function classFromLabel(display: string, label?: string): WindowPoint["class"] {
  const text = `${display} ${label ?? ""}`.toLowerCase();
  if (text.includes("short")) return "Short Circuit Abnormality";
  if (text.includes("transfer")) return "Transfer Change";
  if (text.includes("instability") || text.includes("unstable") || text.includes("arc")) return "Arc Instability";
  return "Normal";
}
