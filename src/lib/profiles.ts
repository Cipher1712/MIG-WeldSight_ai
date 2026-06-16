// Material + thickness based profile model. Profiles are normally provisioned
// by the backend (training pipeline). The frontend caches them in
// localStorage so the operator sees status (trained / untrained, samples,
// updated_at) immediately after page load and so Live mode can render a
// sensible Adaptive Threshold while the WS hand-shake completes.

export const MATERIALS = [
  { key: "mild_steel", label: "Mild Steel" },
  { key: "stainless", label: "Stainless Steel" },
  { key: "aluminium", label: "Aluminium" },
  { key: "copper_alloy", label: "Copper Alloy" },
  { key: "hsla", label: "HSLA" },
  { key: "cast_iron", label: "Cast Iron" },
  { key: "custom", label: "Custom" },
] as const;

export type MaterialKey = (typeof MATERIALS)[number]["key"];

export const THICKNESSES = [1, 2, 3, 4, 5, 6, 8, 10, 12] as const;
export type ThicknessMm = number;

export interface ProcessSetup {
  material: MaterialKey;
  thickness_mm: ThicknessMm;
}

export interface BaselineProfile {
  material: MaterialKey;
  thickness_mm: ThicknessMm;
  learned_k: number;
  mean_score: number;
  std_score: number;
  voltage_min: number;
  voltage_max: number;
  rms_min: number;
  rms_max: number;
  trained_windows: number;
  updated_at: number; // epoch ms
}

export function profileKey(s: ProcessSetup): string {
  return `${s.material}_${s.thickness_mm}mm`;
}

const STORAGE = "weldsight.profiles.v1";

export function loadProfiles(): Record<string, BaselineProfile> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE) ?? "{}");
  } catch {
    return {};
  }
}

export function saveProfile(p: BaselineProfile) {
  if (typeof window === "undefined") return;
  const all = loadProfiles();
  all[profileKey(p)] = p;
  localStorage.setItem(STORAGE, JSON.stringify(all));
}

export function getProfile(s: ProcessSetup): BaselineProfile | null {
  return loadProfiles()[profileKey(s)] ?? null;
}