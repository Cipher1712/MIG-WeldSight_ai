import { useState } from "react";
import { motion } from "framer-motion";
import {
  saveProfile,
  type BaselineProfile,
  type ProcessSetup,
} from "@/lib/profiles";
import { parseCsvToWindows } from "@/lib/stream";

export function TrainingPanel({
  setup,
  onProfileLearned,
}: {
  setup: ProcessSetup;
  onProfileLearned: (p: BaselineProfile) => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [training, setTraining] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<BaselineProfile | null>(null);

  const onPick = (list: FileList | null) => {
    if (!list) return;
    setFiles(Array.from(list));
    setResult(null);
  };

  const train = async () => {
    if (!files.length) return;
    setTraining(true);
    setProgress(0);
    const allScores: number[] = [];
    const allVoltage: number[] = [];
    for (let i = 0; i < files.length; i++) {
      const wins = await parseCsvToWindows(files[i]);
      wins.forEach((w) => {
        allScores.push(w.score);
        if (typeof w.voltage === "number") allVoltage.push(w.voltage);
      });
      setProgress(Math.round(((i + 1) / files.length) * 100));
      await new Promise((r) => setTimeout(r, 120));
    }
    const mean = avg(allScores);
    const std = stdev(allScores, mean);
    const vMin = Math.min(...allVoltage, 0);
    const vMax = Math.max(...allVoltage, 0);
    const rms = Math.sqrt(avg(allVoltage.map((v) => v * v)));
    const profile: BaselineProfile = {
      material: setup.material,
      thickness_mm: setup.thickness_mm,
      learned_k: +clamp(2.4 + std * 0.6, 2.0, 4.5).toFixed(2),
      mean_score: +mean.toFixed(3),
      std_score: +std.toFixed(3),
      voltage_min: +vMin.toFixed(2),
      voltage_max: +vMax.toFixed(2),
      rms_min: +(rms * 0.9).toFixed(2),
      rms_max: +(rms * 1.1).toFixed(2),
      trained_windows: allScores.length,
      updated_at: Date.now(),
    };
    saveProfile(profile);
    setResult(profile);
    onProfileLearned(profile);
    setTraining(false);
  };

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.6)]">
        <h2 className="text-2xl">Training & Calibration</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Upload one or more <span className="italic">known-good</span> weld CSV files.
          The training pipeline learns the baseline process profile for
          <span className="italic"> {setup.material} · {setup.thickness_mm} mm</span> and
          stores it. Live monitoring then uses the learned <code>k</code> automatically — no
          operator tuning required.
        </p>

        <div className="mt-5 flex flex-col gap-4 md:flex-row md:items-center">
          <label className="cursor-pointer rounded-lg border border-border bg-secondary px-5 py-2.5 text-sm hover:bg-accent">
            Select Good Welds (CSV)
            <input type="file" accept=".csv" multiple className="hidden" onChange={(e) => onPick(e.target.files)} />
          </label>
          <span className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            {files.length} file{files.length === 1 ? "" : "s"} selected
          </span>
          <button
            onClick={train}
            disabled={!files.length || training}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {training ? "Training…" : "Train Baseline"}
          </button>
        </div>

        {training && (
          <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-background/50">
            <motion.div
              className="h-full rounded-full"
              style={{ background: "var(--status-warning)" }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        )}
      </div>

      {result && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.6)]">
          <div className="flex items-center justify-between">
            <h3 className="text-xl">Learned Baseline</h3>
            <span className="text-xs uppercase tracking-[0.22em]" style={{ color: "var(--status-stable)" }}>
              ✓ Persisted
            </span>
          </div>
          <pre className="mt-4 overflow-x-auto rounded-xl border border-border bg-background/40 p-4 text-xs leading-relaxed text-muted-foreground">
{JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </section>
  );
}

function avg(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
function stdev(xs: number[], mean: number) {
  if (xs.length < 2) return 0;
  return Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / (xs.length - 1));
}
function clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x));
}