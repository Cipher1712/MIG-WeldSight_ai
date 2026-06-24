import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface VoltageSample {
  distance: number;
  voltage: number;
}

export function RawVoltageChart({ data }: { data: VoltageSample[] }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.6)]">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl">Raw Arc Voltage</h2>
        <span className="text-xs uppercase tracking-[0.22em] text-muted-foreground">V vs Distance</span>
      </div>
      <div className="h-[260px] w-full">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border/70 text-sm italic text-muted-foreground">
            Waiting for voltage samples...
          </div>
        ) : (
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 10, right: 20, bottom: 40, left: 10 }}>
              <CartesianGrid stroke="var(--border)" strokeOpacity={0.35} strokeDasharray="2 4" />
              <XAxis
                dataKey="distance"
                type="number"
                domain={["dataMin", "dataMax"]}
                stroke="var(--muted-foreground)"
                tick={{ fontFamily: "var(--font-serif)", fontSize: 12 }}
                label={{ value: "Distance (mm)", position: "insideBottom", offset: -28, fill: "var(--muted-foreground)" }}
              />
              <YAxis
                stroke="var(--muted-foreground)"
                tick={{ fontFamily: "var(--font-serif)", fontSize: 12 }}
                domain={["dataMin - 1", "dataMax + 1"]}
                label={{ value: "Voltage (V)", angle: -90, position: "insideLeft", fill: "var(--muted-foreground)" }}
              />
              <Tooltip
                contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", fontFamily: "var(--font-serif)" }}
              />
              <Line type="monotone" dataKey="voltage" stroke="var(--tag-blue)" strokeWidth={1.4} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
