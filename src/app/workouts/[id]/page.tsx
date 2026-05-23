import Link from "next/link";
import { notFound } from "next/navigation";
import type { WorkoutMetric } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { isoDay } from "@/lib/dates";

type Params = Promise<{ id: string }>;

type TimelineSegment = {
  fromPct: number;
  toPct: number;
  durationSec: number | null;
  distance: number | null;
  avgSpeed: number | null;
  avgHr: number | null;
};

type Timeline = {
  units: {
    speed: string;
    distance: string;
    hr: string;
  };
  segments: TimelineSegment[];
};

const primaryMetricKeys = [
  "moving_time_s",
  "avg_hr",
  "max_hr",
  "calories",
  "avg_cadence",
  "max_cadence",
  "avg_speed",
  "max_speed",
  "ascent",
  "descent",
  "training_load",
  "training_effect",
  "anaerobic_training_effect",
] as const;

const garminTagKeys = [
  "garmin_sport",
  "garmin_sub_sport",
  "garmin_type",
  "garmin_self_eval_feel",
  "garmin_self_eval_effort",
] as const;

const metricLabels: Record<string, string> = {
  moving_time_s: "Moving time",
  avg_hr: "Avg HR",
  max_hr: "Max HR",
  calories: "Calories",
  avg_cadence: "Avg cadence",
  max_cadence: "Max cadence",
  avg_speed: "Avg speed",
  max_speed: "Max speed",
  ascent: "Ascent",
  descent: "Descent",
  training_load: "Training load",
  training_effect: "Aerobic effect",
  anaerobic_training_effect: "Anaerobic effect",
  garmin_sport: "Sport",
  garmin_sub_sport: "Sub-sport",
  garmin_type: "Garmin type",
  garmin_self_eval_feel: "Feel",
  garmin_self_eval_effort: "Effort",
};

export default async function WorkoutPage({ params }: { params: Params }) {
  const { id } = await params;
  const workout = await prisma.workout.findUnique({
    where: { id },
    include: {
      metrics: {
        orderBy: { key: "asc" },
      },
    },
  });
  if (!workout) return notFound();

  const metricByKey = new Map(workout.metrics.map((metric) => [metric.key, metric]));
  const timeline = parseTimeline(metricByKey.get("record_timeline")?.valueText);
  const fallbackUnits = metricFallbackUnits(timeline, workout.distanceUnit);
  const primaryMetrics = primaryMetricKeys
    .map((key) => metricByKey.get(key))
    .filter((metric): metric is WorkoutMetric => metric != null);
  const garminTags = garminTagKeys
    .map((key) => metricByKey.get(key))
    .filter((metric): metric is WorkoutMetric => metric?.valueText != null);
  const hrZones = heartRateZones(metricByKey);
  const usedMetricKeys = new Set<string>([
    "record_timeline",
    ...primaryMetricKeys,
    ...garminTagKeys,
    ...Array.from({ length: 5 }, (_, index) => `hr_zone_${index + 1}_time_s`),
  ]);
  const otherMetrics = workout.metrics.filter((metric) => !usedMetricKeys.has(metric.key));
  const title = workout.title ?? `${workout.type} workout`;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <Link href="/workouts" className="text-sm text-zinc-500 hover:text-zinc-900">
            Workouts
          </Link>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="text-sm text-zinc-600">
            {isoDay(new Date(workout.date))} · {workout.type} · {workout.source}
          </p>
        </div>
        <Link
          href={`/workouts/${workout.id}/edit`}
          className="w-fit rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
        >
          Edit
        </Link>
      </header>

      <section className="grid gap-3 sm:grid-cols-4">
        <SummaryStat
          label="Distance"
          value={workout.distance != null ? `${formatNumber(workout.distance)} ${workout.distanceUnit ?? ""}` : "—"}
        />
        <SummaryStat label="Duration" value={workout.durationMin != null ? `${workout.durationMin}m` : "—"} />
        <SummaryStat label="RPE" value={workout.rpe != null ? String(workout.rpe) : "—"} />
        <SummaryStat label="Soreness" value={workout.soreness != null ? String(workout.soreness) : "—"} />
      </section>

      {workout.notes && (
        <section className="rounded border border-zinc-200 bg-white p-4">
          <h2 className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Notes</h2>
          <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-800">{workout.notes}</p>
        </section>
      )}

      <section className="rounded border border-zinc-200 bg-white p-4">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-semibold">Garmin timeline</h2>
          </div>
          {timeline && (
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              speed {timeline.units.speed || "—"} · distance {timeline.units.distance || "—"}
            </p>
          )}
        </div>

        {timeline ? (
          <TimelineView timeline={timeline} />
        ) : (
          <p className="text-sm text-zinc-500">No Garmin timeline samples are stored for this workout.</p>
        )}
      </section>

      {(primaryMetrics.length > 0 || garminTags.length > 0 || hrZones.length > 0) && (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded border border-zinc-200 bg-white p-4">
            <h2 className="mb-3 text-base font-semibold">Garmin metrics</h2>
            {garminTags.length > 0 && (
              <dl className="mb-4 grid grid-cols-2 gap-3 text-sm">
                {garminTags.map((metric) => (
                  <MetricItem key={metric.key} label={metricLabels[metric.key] ?? metric.key} value={metric.valueText ?? "—"} />
                ))}
              </dl>
            )}
            {primaryMetrics.length > 0 ? (
              <dl className="grid grid-cols-2 gap-3 text-sm">
                {primaryMetrics.map((metric) => (
                  <MetricItem
                    key={metric.key}
                    label={metricLabels[metric.key] ?? metric.key}
                    value={formatMetricValue(metric, fallbackUnits)}
                  />
                ))}
              </dl>
            ) : (
              <p className="text-sm text-zinc-500">No Garmin summary metrics are stored for this workout.</p>
            )}
          </div>

          <div className="rounded border border-zinc-200 bg-white p-4">
            <h2 className="mb-3 text-base font-semibold">Heart rate zones</h2>
            {hrZones.length > 0 ? (
              <HeartRateZones zones={hrZones} />
            ) : (
              <p className="text-sm text-zinc-500">No heart-rate zone data is stored for this workout.</p>
            )}
          </div>
        </section>
      )}

      {otherMetrics.length > 0 && (
        <section className="rounded border border-zinc-200 bg-white p-4">
          <h2 className="mb-3 text-base font-semibold">Other stored metrics</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-zinc-500">
                <tr>
                  <th className="py-2 pr-4">Metric</th>
                  <th className="py-2 pr-4">Value</th>
                </tr>
              </thead>
              <tbody>
                {otherMetrics.map((metric) => (
                  <tr key={metric.id} className="border-t border-zinc-100">
                    <td className="py-2 pr-4 font-mono text-xs text-zinc-500">{metric.key}</td>
                    <td className="py-2 pr-4">{formatMetricValue(metric, fallbackUnits)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-zinc-200 bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}

function MetricItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="mt-0.5 font-medium text-zinc-900">{value}</dd>
    </div>
  );
}

function TimelineView({ timeline }: { timeline: Timeline }) {
  const maxSpeed = Math.max(...timeline.segments.map((segment) => segment.avgSpeed ?? 0), 0);
  const maxHr = Math.max(...timeline.segments.map((segment) => segment.avgHr ?? 0), 0);

  return (
    <div className="space-y-3">
      {timeline.segments.map((segment) => (
        <div
          key={`${segment.fromPct}-${segment.toPct}`}
          className="grid gap-2 border-t border-zinc-100 pt-3 first:border-t-0 first:pt-0 sm:grid-cols-[72px_minmax(0,1fr)_minmax(0,1fr)] sm:items-center"
        >
          <div>
            <div className="font-mono text-sm font-medium">{segment.fromPct}-{segment.toPct}%</div>
            <div className="text-xs text-zinc-500">{segment.durationSec != null ? formatDuration(segment.durationSec) : "—"}</div>
          </div>
          <TimelineBar
            label="Speed"
            value={segment.avgSpeed}
            unit={timeline.units.speed}
            widthPct={barWidth(segment.avgSpeed, maxSpeed)}
            colorClass="bg-emerald-500"
          />
          <TimelineBar
            label="HR"
            value={segment.avgHr}
            unit={timeline.units.hr}
            widthPct={barWidth(segment.avgHr, maxHr)}
            colorClass="bg-rose-500"
            roundValue
          />
          <div className="text-xs text-zinc-500 sm:col-start-2">
            Distance {segment.distance != null ? `${formatNumber(segment.distance)} ${timeline.units.distance}` : "—"}
          </div>
        </div>
      ))}
    </div>
  );
}

function TimelineBar({
  label,
  value,
  unit,
  widthPct,
  colorClass,
  roundValue = false,
}: {
  label: string;
  value: number | null;
  unit: string;
  widthPct: number;
  colorClass: string;
  roundValue?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center justify-between gap-2 text-xs text-zinc-500">
        <span>{label}</span>
        <span className="font-mono text-zinc-700">
          {value != null ? `${roundValue ? Math.round(value) : formatNumber(value)} ${unit}` : "—"}
        </span>
      </div>
      <div className="h-2 rounded bg-zinc-100">
        <div className={`h-2 rounded ${colorClass}`} style={{ width: `${widthPct}%` }} />
      </div>
    </div>
  );
}

function HeartRateZones({ zones }: { zones: Array<{ zone: number; seconds: number }> }) {
  const total = zones.reduce((sum, zone) => sum + zone.seconds, 0);

  return (
    <div className="space-y-3">
      {zones.map((zone) => {
        const pct = total > 0 ? Math.round((zone.seconds / total) * 100) : 0;
        return (
          <div key={zone.zone}>
            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
              <span className="font-medium">Zone {zone.zone}</span>
              <span className="font-mono text-zinc-600">
                {formatDuration(zone.seconds)} · {pct}%
              </span>
            </div>
            <div className="h-2 rounded bg-zinc-100">
              <div className="h-2 rounded bg-sky-500" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function parseTimeline(raw: string | null | undefined): Timeline | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as {
      units?: Record<string, unknown>;
      segments?: unknown[];
    };
    if (!Array.isArray(parsed.segments)) return null;

    const segments = parsed.segments
      .map((segment) => normalizeTimelineSegment(segment))
      .filter((segment): segment is TimelineSegment => segment != null);
    if (segments.length === 0) return null;

    return {
      units: {
        speed: stringValue(parsed.units?.speed),
        distance: stringValue(parsed.units?.distance),
        hr: stringValue(parsed.units?.hr) || "bpm",
      },
      segments,
    };
  } catch {
    return null;
  }
}

function normalizeTimelineSegment(segment: unknown): TimelineSegment | null {
  if (segment == null || typeof segment !== "object") return null;
  const row = segment as Record<string, unknown>;
  const fromPct = finiteNumber(row.fromPct);
  const toPct = finiteNumber(row.toPct);
  if (fromPct == null || toPct == null) return null;

  return {
    fromPct,
    toPct,
    durationSec: finiteNumber(row.durationSec),
    distance: finiteNumber(row.distance),
    avgSpeed: finiteNumber(row.avgSpeed),
    avgHr: finiteNumber(row.avgHr),
  };
}

function heartRateZones(metricByKey: Map<string, WorkoutMetric>): Array<{ zone: number; seconds: number }> {
  return Array.from({ length: 5 }, (_, index) => {
    const zone = index + 1;
    const seconds = metricByKey.get(`hr_zone_${zone}_time_s`)?.valueNum;
    return { zone, seconds: seconds != null ? Math.max(0, Math.round(seconds)) : 0 };
  }).filter((zone) => zone.seconds > 0 || metricByKey.has(`hr_zone_${zone.zone}_time_s`));
}

function metricFallbackUnits(timeline: Timeline | null, distanceUnit: string | null): Record<string, string> {
  const speedUnit = timeline?.units.speed || (distanceUnit === "km" || distanceUnit === "m" ? "km/h" : "mph");
  const elevationUnit = distanceUnit === "km" || distanceUnit === "m" ? "m" : "ft";
  return {
    avg_speed: speedUnit,
    max_speed: speedUnit,
    ascent: elevationUnit,
    descent: elevationUnit,
  };
}

function formatMetricValue(metric: WorkoutMetric, fallbackUnits: Record<string, string>): string {
  if (metric.valueText) return metric.valueText;
  if (metric.valueNum == null) return "—";
  if (metric.key.endsWith("_time_s")) return formatDuration(metric.valueNum);
  const unit = metric.unit ?? fallbackUnits[metric.key] ?? "";
  return unit ? `${formatNumber(metric.valueNum)} ${unit}` : formatNumber(metric.valueNum);
}

function formatDuration(seconds: number): string {
  const rounded = Math.max(0, Math.round(seconds));
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const secs = rounded % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

function formatNumber(value: number): string {
  const rounded = Math.abs(value) >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
  return String(rounded);
}

function barWidth(value: number | null, max: number): number {
  if (value == null || max <= 0) return 0;
  return Math.max(4, Math.min(100, Math.round((value / max) * 100)));
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}
