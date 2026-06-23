import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { WindowPoint } from "@/lib/stream";

const NO_DATA = "No Data";

export function AssessmentDetailsPanel({ latest }: { latest: WindowPoint | null }) {
  const riskScores = [
    ["Arc Instability", latest?.arc_instability_score],
    ["Spatter Risk", latest?.spatter_risk_score],
    ["Burn Through Risk", latest?.burn_through_risk_score],
    ["Low Heat Input Risk", latest?.low_heat_input_score],
  ] as const;
  const qualityBreakdown = latest?.quality_breakdown ? Object.entries(latest.quality_breakdown) : [];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Details</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assessment Details</DialogTitle>
          <DialogDescription>Latest backend assessment output.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <DetailBlock title="Diagnosis" value={latest?.diagnosis} />
          <DetailBlock title="Recommendation" value={latest?.recommendation} />

          <section>
            <h3 className="text-sm uppercase tracking-[0.22em] text-muted-foreground">Risk Scores</h3>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {riskScores.map(([label, value]) => (
                <MetricCell key={label} label={label} value={value} />
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-sm uppercase tracking-[0.22em] text-muted-foreground">Top Contributors</h3>
            {latest?.top_contributors?.length ? (
              <div className="mt-3 space-y-2">
                {latest.top_contributors.map((item, index) => (
                  <div
                    key={`${item.feature}-${index}`}
                    className="grid grid-cols-1 gap-2 rounded-lg border border-border/70 bg-background/30 px-4 py-3 sm:grid-cols-[1fr_auto_auto]"
                  >
                    <span className="text-sm">{valueOrNoData(item.feature)}</span>
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {valueOrNoData(item.importance)}
                    </span>
                    <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      {valueOrNoData(item.method)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <NoDataLine />
            )}
          </section>

          <section>
            <h3 className="text-sm uppercase tracking-[0.22em] text-muted-foreground">Quality Breakdown</h3>
            {qualityBreakdown.length ? (
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {qualityBreakdown.map(([label, value]) => (
                  <MetricCell key={label} label={label} value={value} />
                ))}
              </div>
            ) : (
              <NoDataLine />
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailBlock({ title, value }: { title: string; value?: string }) {
  return (
    <section>
      <h3 className="text-sm uppercase tracking-[0.22em] text-muted-foreground">{title}</h3>
      <p className="mt-2 rounded-lg border border-border/70 bg-background/30 px-4 py-3 text-sm leading-relaxed">
        {valueOrNoData(value)}
      </p>
    </section>
  );
}

function MetricCell({ label, value }: { label: string; value?: number }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/30 px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg tabular-nums">{valueOrNoData(value)}</div>
    </div>
  );
}

function NoDataLine() {
  return (
    <div className="mt-3 rounded-lg border border-border/70 bg-background/30 px-4 py-3 text-sm text-muted-foreground">
      {NO_DATA}
    </div>
  );
}

function valueOrNoData(value: string | number | undefined) {
  if (value === undefined || value === null || value === "") return NO_DATA;
  return String(value);
}
