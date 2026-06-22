import type { PhysicsResult } from "@/lib/physicsClassifier";

export interface TimelineEvent {
  distance_mm?: number;
  physics: PhysicsResult | null;
}

export function PhysicsEventsTimeline({ events }: { events: TimelineEvent[] }) {
  const validEvents = events.filter(
    (e): e is { distance_mm: number; physics: PhysicsResult | null } => typeof e.distance_mm === "number",
  );
  const significant = validEvents.filter((e) => e.physics && e.physics.severity !== "NORMAL");
  const max = validEvents.length ? validEvents[validEvents.length - 1].distance_mm : 1;
  const min = validEvents.length ? validEvents[0].distance_mm : 0;
  const span = Math.max(max - min, 1);

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.6)]">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl">Physics Events Timeline</h2>
        <span className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
          {significant.length} events
        </span>
      </div>
      <div className="relative h-16 w-full rounded-xl border border-border bg-background/30">
        <div className="absolute inset-x-3 top-1/2 h-px -translate-y-1/2 bg-border" />
        {significant.map((e, i) => {
          const left = ((e.distance_mm - min) / span) * 100;
          const physics = e.physics!;
          return (
            <div
              key={i}
              className="group absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${left}%` }}
            >
              <span
                className="block h-3 w-3 rounded-full"
                style={{ background: physics.colour, boxShadow: `0 0 10px ${physics.colour}` }}
              />
              <div className="pointer-events-none absolute left-1/2 top-5 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-card px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground group-hover:block">
                <span style={{ color: physics.colour }}>{physics.display_label}</span> - {e.distance_mm.toFixed(1)} mm
              </div>
            </div>
          );
        })}
        {significant.length === 0 && (
          <div className="flex h-full items-center justify-center text-xs italic text-muted-foreground">
            No live anomaly events on this trace.
          </div>
        )}
      </div>
    </section>
  );
}
