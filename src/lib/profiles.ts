// Material + thickness based profile model. Profiles are provisioned by the
// backend training pipeline and read from /api/profiles.

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
  id?: number | string;
  material: MaterialKey;
  thickness_mm: ThicknessMm;
  threshold?: number;
  learned_k: number;
  mean_score: number;
  std_score: number;
  voltage_min?: number;
  voltage_max?: number;
  rms_min?: number;
  rms_max?: number;
  trained_windows: number;
  updated_at?: number | string; // normalized to epoch ms before display
}

export function profileKey(s: ProcessSetup): string {
  return `${s.material}_${s.thickness_mm}mm`;
}
