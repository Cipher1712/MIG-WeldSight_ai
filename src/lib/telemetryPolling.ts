import { API_URL, type BackendFrame, type EventResponse } from "@/lib/apiClient";

export const TELEMETRY_INTERVAL = 500;
export const METRICS_INTERVAL = 500;
export const EVENTS_INTERVAL = 1000;

export type PollingStatus = "Connected" | "Polling" | "Disconnected" | "No Data";

export interface LatestTelemetry {
  voltage?: number[];
  distance_mm?: number;
  arc_on?: boolean;
  timestamp?: number;
  material?: string;
  thickness_mm?: number;
  latest_inference?: BackendFrame;
}

export interface LatestMetrics {
  quality_index?: number;
  quality_score?: number;
  prediction?: BackendFrame["prediction"];
  confidence?: number;
  arc_instability_score?: number;
  spatter_risk_score?: number;
  burn_through_risk_score?: number;
  low_heat_input_score?: number;
  top_contributors?: BackendFrame["top_contributors"];
  quality_breakdown?: BackendFrame["quality_breakdown"];
  stability?: number;
  anomalies?: {
    detected?: boolean;
    score?: number;
    threshold?: number;
    severity?: string;
    physics_label?: string;
    ml_label?: string;
  };
  status?: string;
  diagnosis?: string;
  model_ready?: boolean;
  timestamp?: number;
}

export type LatestEvent = EventResponse;

export interface TelemetrySnapshot {
  telemetry: LatestTelemetry | null;
  metrics: LatestMetrics | null;
  events: LatestEvent[];
}

export interface TelemetryPollingHandle {
  close: () => void;
  source: "polling";
}

type PollingOptions = {
  onTelemetry?: (telemetry: LatestTelemetry | null) => void;
  onMetrics?: (metrics: LatestMetrics | null) => void;
  onEvents?: (events: LatestEvent[]) => void;
  onStatus?: (status: PollingStatus) => void;
};

const REQUEST_TIMEOUT_MS = 8000;
const DISCONNECTED_FAILURES = 3;
const CONNECTED_WINDOW_MS = 5000;

export function startTelemetryPolling(options: PollingOptions): TelemetryPollingHandle {
  let closed = false;
  let activeRequests = 0;
  let failures = 0;
  let lastSuccess = 0;
  let lastHadData = false;
  let telemetryTimer: number | undefined;
  let metricsTimer: number | undefined;
  let eventsTimer: number | undefined;

  const emitStatus = (hadData = lastHadData) => {
    lastHadData = hadData;
    if (closed) return;
    if (activeRequests > 0) {
      options.onStatus?.("Polling");
      return;
    }
    if (failures >= DISCONNECTED_FAILURES) {
      options.onStatus?.("Disconnected");
      return;
    }
    if (!hadData) {
      options.onStatus?.("No Data");
      return;
    }
    if (Date.now() - lastSuccess < CONNECTED_WINDOW_MS) {
      options.onStatus?.("Connected");
      return;
    }
    options.onStatus?.("Disconnected");
  };

  const poll = async <T>(path: string, onData: (data: T) => boolean) => {
    activeRequests += 1;
    emitStatus();
    try {
      const data = await fetchJson<T>(path);
      failures = 0;
      lastSuccess = Date.now();
      const hasData = onData(data);
      emitStatus(hasData || lastHadData);
    } catch {
      failures += 1;
      emitStatus(lastHadData);
    } finally {
      activeRequests = Math.max(0, activeRequests - 1);
      emitStatus(lastHadData);
    }
  };

  const pollTelemetry = () =>
    poll<LatestTelemetry>("/telemetry/latest", (data) => {
      const hasData = isNonEmptyObject(data);
      options.onTelemetry?.(hasData ? data : null);
      return hasData;
    });

  const pollMetrics = () =>
    poll<LatestMetrics>("/metrics/latest", (data) => {
      const hasData = isNonEmptyObject(data);
      options.onMetrics?.(hasData ? data : null);
      return hasData;
    });

  const pollEvents = () =>
    poll<LatestEvent[]>("/events/latest", (data) => {
      const events = Array.isArray(data) ? data : [];
      options.onEvents?.(events);
      return events.length > 0;
    });

  pollTelemetry();
  pollMetrics();
  pollEvents();
  telemetryTimer = window.setInterval(pollTelemetry, TELEMETRY_INTERVAL);
  metricsTimer = window.setInterval(pollMetrics, METRICS_INTERVAL);
  eventsTimer = window.setInterval(pollEvents, EVENTS_INTERVAL);

  return {
    source: "polling",
    close: () => {
      closed = true;
      if (telemetryTimer) window.clearInterval(telemetryTimer);
      if (metricsTimer) window.clearInterval(metricsTimer);
      if (eventsTimer) window.clearInterval(eventsTimer);
    },
  };
}

export async function fetchLatestTelemetry(): Promise<LatestTelemetry | null> {
  const data = await fetchJson<LatestTelemetry>("/telemetry/latest");
  return isNonEmptyObject(data) ? data : null;
}

export async function fetchLatestMetrics(): Promise<LatestMetrics | null> {
  const data = await fetchJson<LatestMetrics>("/metrics/latest");
  return isNonEmptyObject(data) ? data : null;
}

export async function fetchLatestEvents(): Promise<LatestEvent[]> {
  const data = await fetchJson<LatestEvent[]>("/events/latest");
  return Array.isArray(data) ? data : [];
}

async function fetchJson<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return (await response.json()) as T;
  } finally {
    window.clearTimeout(timer);
  }
}

function isNonEmptyObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0;
}
