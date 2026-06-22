import { useState } from "react";
import { motion } from "framer-motion";
import {
  type BaselineProfile,
  type ProcessSetup,
} from "@/lib/profiles";
import { normalizeProfile, weldSightApi } from "@/lib/apiClient";
import { parseCsvVoltage } from "@/lib/stream";

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
  const [error, setError] = useState<string | null>(null);

  const onPick = (list: FileList | null) => {
    if (!list) return;
    setFiles(Array.from(list));
    setResult(null);
    setError(null);
  };

  const train = async () => {
    if (!files.length) return;
    setTraining(true);
    setProgress(0);
    setError(null);
    try {
      const good_welds = [];
      for (let i = 0; i < files.length; i++) {
        const parsed = await parseCsvVoltage(files[i]);
        if (parsed.voltage.length) good_welds.push({ voltage: parsed.voltage });
        setProgress(Math.round(((i + 1) / files.length) * 80));
      }
      if (!good_welds.length) throw new Error("No voltage samples found in selected CSV files.");
      const profile = normalizeProfile(await weldSightApi.train({ ...setup, good_welds }));
      setProgress(100);
      setResult(profile);
      onProfileLearned(profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Training failed");
    } finally {
      setTraining(false);
    }
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

        {error && (
          <div className="mt-5 rounded-xl border border-border bg-background/40 px-4 py-3 text-sm italic text-muted-foreground">
            {error}
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
