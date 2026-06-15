// Dynamic EWMA-based anomaly threshold for MIG voltage windows.
// Mirrors the spec: per-material presets, sensitivity k, warmup period
// during which a static floor threshold is used until enough samples
// are gathered to trust the running EWMA + sigma.

export type MaterialKey = "mild_steel" | "stainless" | "aluminum";

export interface MaterialPreset {
  key: MaterialKey;
  label: string;
  k: number;            // default sensitivity multiplier
  warmup: number;       // windows of warmup before adaptive kicks in
  floor: number;        // static threshold during warmup
  ewmaAlpha: number;    // smoothing factor for EWMA mean
  varAlpha: number;     // smoothing factor for running variance
  description: string;
}

export const MATERIAL_PRESETS: Record<MaterialKey, MaterialPreset> = {
  mild_steel: {
    key: "mild_steel",
    label: "Mild Steel",
    k: 3.0,
    warmup: 30,
    floor: 3.5,
    ewmaAlpha: 0.15,
    varAlpha: 0.08,
    description: "General structural welding. Balanced sensitivity.",
  },
  stainless: {
    key: "stainless",
    label: "Stainless Steel",
    k: 2.6,
    warmup: 30,
    floor: 3.2,
    ewmaAlpha: 0.18,
    varAlpha: 0.1,
    description: "Lower heat input — tighter envelope, more sensitive.",
  },
  aluminum: {
    key: "aluminum",
    label: "Aluminum",
    k: 3.6,
    warmup: 40,
    floor: 4.0,
    ewmaAlpha: 0.12,
    varAlpha: 0.06,
    description: "High thermal conductivity — wider arc variability.",
  },
};

export interface ThresholdSample {
  threshold: number;
  ewma: number;
  sigma: number;
  warmup: boolean;
  n: number;
  k: number;
}

export class DynamicThreshold {
  private preset: MaterialPreset;
  private k: number;
  private mean = 0;
  private variance = 0;
  private n = 0;

  constructor(material: MaterialKey = "mild_steel", k?: number) {
    this.preset = MATERIAL_PRESETS[material];
    this.k = k ?? this.preset.k;
  }

  setMaterial(material: MaterialKey) {
    this.preset = MATERIAL_PRESETS[material];
    // do NOT clobber k — caller (UI) controls slider value
  }

  setK(k: number) {
    this.k = k;
  }

  reset() {
    this.mean = 0;
    this.variance = 0;
    this.n = 0;
  }

  /** Feed one window's anomaly score; returns the threshold to apply NOW. */
  update(score: number): ThresholdSample {
    this.n += 1;
    if (this.n === 1) {
      this.mean = score;
      this.variance = 0;
    } else {
      const a = this.preset.ewmaAlpha;
      const va = this.preset.varAlpha;
      const prevMean = this.mean;
      this.mean = a * score + (1 - a) * prevMean;
      const dev = score - prevMean;
      this.variance = (1 - va) * this.variance + va * dev * dev;
    }
    const sigma = Math.sqrt(this.variance);
    const warmup = this.n < this.preset.warmup;
    const adaptive = this.mean + this.k * sigma;
    const threshold = warmup ? this.preset.floor : Math.max(adaptive, this.preset.floor * 0.85);
    return {
      threshold: +threshold.toFixed(3),
      ewma: +this.mean.toFixed(3),
      sigma: +sigma.toFixed(3),
      warmup,
      n: this.n,
      k: this.k,
    };
  }
}

/** Batch helper for CSV upload mode: process all windows in order. */
export function buildThresholdSeries(
  scores: number[],
  material: MaterialKey,
  k: number,
): ThresholdSample[] {
  const dt = new DynamicThreshold(material, k);
  return scores.map((s) => dt.update(s));
}