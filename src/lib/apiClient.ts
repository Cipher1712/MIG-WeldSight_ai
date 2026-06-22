import type { BaselineProfile, MaterialKey, ProcessSetup } from "@/lib/profiles";

const DEFAULT_API_BASE = "https://backend-mig-weldsight-ai.onrender.com";
const API_BASE =
  ((typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) || DEFAULT_API_BASE).replace(/\/+$/, "");

export const API_URL = API_BASE;

export type BackendSeverity = "NORMAL" | "INFO" | "WARNING" | "CRITICAL" | "POOR";

export interface BackendFeatures {
  mean_v?: number;
  std_v?: number;
  min_v?: number;
  max_v?: number;
  sc_count?: number;
  short_circuit_count?: number;
  crest_factor?: number;
}

export interface BackendFrame {
  timestamp?: number | string;
  voltage?: number;
  arc_on?: boolean;
  distance_mm?: number;
  anomaly_score?: number;
  anomaly_detected?: boolean;
  threshold?: number;
  anomaly_threshold?: number;
  quality_score?: number;
  quality_index?: number;
  stability_score?: number;
  prediction?: string;
  status?: string;
  diagnosis?: string;
  top_contributors?: Array<{ feature: string; importance?: number; method?: string }>;
  severity?: BackendSeverity;
  physics_label?: string;
  ml_label?: string;
  confidence?: number;
  recommendation?: string;
  top_features?: Array<{ feature: string; importance?: number; method?: string }>;
  display_label?: string;
  possible_causes?: string[];
  recommended_actions?: string[];
  voltage_features?: BackendFeatures;
  embedding_x?: number;
  embedding_y?: number;
}

export interface InferResponse {
  frames: BackendFrame[];
  cluster?: {
    embeddings?: number[][];
    labels?: number[];
    clusters?: number;
    noise?: number;
  };
  model_ready?: boolean;
}

export interface EventResponse extends BackendFrame {
  ts?: string;
  material?: string;
  thickness_mm?: number;
}

export interface TrainRequest extends ProcessSetup {
  good_welds: Array<{ voltage: number[] }>;
}

export interface HealthResponse {
  status: string;
  timestamp?: number;
  ts?: number;
  model_ready?: boolean;
  vae_loaded?: boolean;
  scaler_loaded?: boolean;
  threshold_loaded?: boolean;
}

const timeoutMs = 15_000;
const retries = 2;

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${API_BASE}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...init.headers,
        },
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
      await new Promise((resolve) => window.setTimeout(resolve, 350 * (attempt + 1)));
    } finally {
      window.clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Request failed");
}

export const weldSightApi = {
  health: () => request<HealthResponse>("/health"),
  profiles: () => request<BaselineProfile[]>("/api/profiles"),
  profile: (material: MaterialKey, thicknessMm: number) =>
    request<BaselineProfile>(`/api/profiles/${material}/${thicknessMm}`),
  train: (body: TrainRequest) =>
    request<BaselineProfile>("/api/train", { method: "POST", body: JSON.stringify(body) }),
  infer: (body: ProcessSetup & { voltage: number[]; distance?: number[] }) =>
    request<InferResponse>("/api/infer", { method: "POST", body: JSON.stringify(body) }),
  events: (limit = 200) => request<EventResponse[]>(`/api/events?limit=${limit}`),
};

export function normalizeProfile(profile: BaselineProfile): BaselineProfile {
  const updatedAt = profile.updated_at;
  const updatedAtMs = typeof updatedAt === "number" ? updatedAt : new Date(updatedAt).getTime();
  return {
    ...profile,
    material: profile.material as MaterialKey,
    updated_at: Number.isFinite(updatedAtMs) ? updatedAtMs : undefined,
    threshold: profile.threshold == null ? undefined : Number(profile.threshold),
    voltage_min: numberOrUndefined(profile.voltage_min),
    voltage_max: numberOrUndefined(profile.voltage_max),
    rms_min: numberOrUndefined(profile.rms_min),
    rms_max: numberOrUndefined(profile.rms_max),
  };
}

function numberOrUndefined(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}
