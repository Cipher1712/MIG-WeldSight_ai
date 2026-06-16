// WebSocket stream service for live MIG voltage windows, with simulated
// fallback when no backend is reachable. The same WindowPoint shape is
// produced from CSV uploads so the UI rendering layer is mode-agnostic.

export type WindowPoint = {
  distance_mm: number;
  score: number;
  status: "Stable" | "Anomaly";
  class: "Normal" | "Arc Instability" | "Transfer Change" | "Short Circuit Abnormality";
  embedding_x: number;
  embedding_y: number;
  threshold: number;
  // industrial fields (always populated; sim derives them, backend sends them verbatim)
  voltage?: number;
  arc_on?: boolean;
  timestamp?: number;
};

export type StreamHandle = {
  close: () => void;
  source: "websocket" | "simulated";
};

const DEFAULT_WS =
  (typeof import.meta !== "undefined" && (import.meta as { env?: { VITE_WS_URL?: string } }).env?.VITE_WS_URL) ||
  "ws://localhost:8000/ws/live";
export const REST_INFER_URL =
  ((typeof import.meta !== "undefined" && (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL) || "") +
  "/api/infer";

export function connectStream(
  onMessage: (p: WindowPoint) => void,
  opts?: { url?: string; onStatus?: (s: "connecting" | "open" | "closed" | "simulated") => void },
): StreamHandle {
  const url = opts?.url ?? DEFAULT_WS;
  opts?.onStatus?.("connecting");
  let ws: WebSocket | null = null;
  let simTimer: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  const startSimulation = () => {
    opts?.onStatus?.("simulated");
    let i = 0;
    simTimer = setInterval(() => {
      if (closed) return;
      onMessage(simulateWindow(i++));
    }, 600);
  };

  try {
    ws = new WebSocket(url);
    const fallbackTimer = setTimeout(() => {
      if (ws && ws.readyState !== WebSocket.OPEN) {
        try { ws.close(); } catch { /* noop */ }
        if (!closed) startSimulation();
      }
    }, 1200);
    ws.onopen = () => { clearTimeout(fallbackTimer); opts?.onStatus?.("open"); };
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as WindowPoint;
        onMessage(data);
      } catch {
        /* ignore malformed frames */
      }
    };
    ws.onerror = () => { /* fallbackTimer handles closure */ };
    ws.onclose = () => {
      opts?.onStatus?.("closed");
      if (!closed && !simTimer) startSimulation();
    };
  } catch {
    startSimulation();
  }

  return {
    source: "websocket",
    close: () => {
      closed = true;
      if (simTimer) clearInterval(simTimer);
      if (ws && ws.readyState <= 1) { try { ws.close(); } catch { /* noop */ } }
    },
  };
}

// Deterministic simulator — generates realistic-looking windows with rare anomalies.
let simState = 1337;
function rand() {
  simState = (simState * 9301 + 49297) % 233280;
  return simState / 233280;
}
export function simulateWindow(i: number): WindowPoint {
  const isAnomaly = rand() < 0.12;
  const cls = isAnomaly
    ? (["Arc Instability", "Transfer Change", "Short Circuit Abnormality"] as const)[
        Math.floor(rand() * 3)
      ]
    : "Normal";
  const score = isAnomaly ? +(4 + rand() * 8).toFixed(3) : +(0.2 + rand() * 1.6).toFixed(3);
  const distance_mm = +(i * 1.8 + rand() * 0.6).toFixed(2);
  const { x, y } = embedFor(cls, rand);
  return {
    distance_mm,
    score,
    status: isAnomaly ? "Anomaly" : "Stable",
    class: cls,
    embedding_x: x,
    embedding_y: y,
    threshold: 3.5,
  };
}

function embedFor(cls: WindowPoint["class"], r: () => number) {
  // Pseudo-PCA: normal welding lives in a dense blob; each anomaly class drifts away.
  const blob = (cx: number, cy: number, spread: number) => ({
    x: +(cx + (r() - 0.5) * spread).toFixed(3),
    y: +(cy + (r() - 0.5) * spread).toFixed(3),
  });
  switch (cls) {
    case "Normal":
      return blob(0, 0, 0.9);
    case "Arc Instability":
      return blob(2.6 + r() * 0.6, 1.4 + r() * 0.6, 0.6);
    case "Transfer Change":
      return blob(-2.4 - r() * 0.6, 1.8 + r() * 0.6, 0.6);
    case "Short Circuit Abnormality":
      return blob(0.2 + r() * 0.6, -2.6 - r() * 0.6, 0.6);
  }
}

// Convert a CSV file into a deterministic stream of WindowPoints.
// Expected columns (case-insensitive): distance, score. Other columns optional.
export async function parseCsvToWindows(file: File): Promise<WindowPoint[]> {
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
  if (!lines.length) return [];
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const distIdx = header.findIndex((h) => h.includes("distance"));
  const scoreIdx = header.findIndex((h) => h.includes("score") || h.includes("voltage"));
  const out: WindowPoint[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const distance_mm = distIdx >= 0 ? Number(cols[distIdx]) : i * 1.8;
    const score = scoreIdx >= 0 ? Number(cols[scoreIdx]) : Math.abs(Math.sin(i)) * 5;
    if (!Number.isFinite(distance_mm) || !Number.isFinite(score)) continue;
    const isAnomaly = score >= 3.5;
    const cls: WindowPoint["class"] = !isAnomaly
      ? "Normal"
      : score > 7
        ? "Short Circuit Abnormality"
        : score > 5
          ? "Arc Instability"
          : "Transfer Change";
    const seededR = seededRandom(i);
    const { x, y } = embedFor(cls, seededR);
    out.push({
      distance_mm: +distance_mm.toFixed(2),
      score: +score.toFixed(3),
      status: isAnomaly ? "Anomaly" : "Stable",
      class: cls,
      embedding_x: x,
      embedding_y: y,
      threshold: 3.5,
    });
  }
  return out;
}

function seededRandom(seed: number) {
  let s = seed * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
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