import { prisma } from "@/lib/db";
import { addDays, dayStart, isoDay, sundayOf } from "@/lib/dates";

export type WeeklyTotal = {
  weekStart: string;
  swimYd: number;
  bikeMi: number;
  runMi: number;
  liftSessions: number;
  restDays: number;
  totalDurationMin: number;
};

export type RecentWorkout = {
  date: string;
  type: string;
  title: string | null;
  durationMin: number | null;
  distance: number | null;
  distanceUnit: string | null;
  rpe: number | null;
  soreness: number | null;
  notes: string | null;
};

export type RecentDailyHealth = {
  date: string;
  steps: number | null;
  restingHr: number | null;
  avgHr: number | null;
  stressAvg: number | null;
  intensityMin: number | null;
  bodyBatteryMin: number | null;
  bodyBatteryMax: number | null;
  hrvLastNightAvg: number | null;
  hrvWeeklyAvg: number | null;
  hrvStatus: string | null;
};

export type LoadFlags = {
  consecutiveHardDays: number;
  daysSinceRest: number;
  sorenessTrend: "rising" | "flat" | "falling";
  swimSessionsLast14d: number;
};

export type Milestone = { date: string; label: string };

function toYards(distance: number, unit: string | null): number {
  if (!unit) return 0;
  switch (unit) {
    case "yd": return distance;
    case "m": return distance * 1.09361;
    case "mi": return distance * 1760;
    case "km": return distance * 1093.61;
    default: return 0;
  }
}

function toMiles(distance: number, unit: string | null): number {
  if (!unit) return 0;
  switch (unit) {
    case "mi": return distance;
    case "km": return distance * 0.621371;
    case "m": return distance * 0.000621371;
    case "yd": return distance / 1760;
    default: return 0;
  }
}

export async function weeklyTotals(weeks = 4, now = new Date()): Promise<WeeklyTotal[]> {
  const firstWeekStart = sundayOf(addDays(now, -7 * (weeks - 1)));
  const since = firstWeekStart;
  const workouts = await prisma.workout.findMany({
    where: { date: { gte: since } },
    orderBy: { date: "asc" },
  });

  const buckets: Record<string, WeeklyTotal> = {};
  for (let i = 0; i < weeks; i++) {
    const ws = addDays(firstWeekStart, i * 7);
    buckets[isoDay(ws)] = {
      weekStart: isoDay(ws),
      swimYd: 0,
      bikeMi: 0,
      runMi: 0,
      liftSessions: 0,
      restDays: 0,
      totalDurationMin: 0,
    };
  }

  for (const w of workouts) {
    const wkStart = isoDay(sundayOf(new Date(w.date)));
    const b = buckets[wkStart];
    if (!b) continue;
    if (w.durationMin) b.totalDurationMin += w.durationMin;
    if (w.type === "swim" && w.distance) b.swimYd += toYards(w.distance, w.distanceUnit);
    else if (w.type === "bike" && w.distance) b.bikeMi += toMiles(w.distance, w.distanceUnit);
    else if (w.type === "run" && w.distance) b.runMi += toMiles(w.distance, w.distanceUnit);
    if (w.type === "lift") b.liftSessions += 1;
    if (w.type === "rest") b.restDays += 1;
  }

  return Object.values(buckets).map((b) => ({
    ...b,
    swimYd: Math.round(b.swimYd),
    bikeMi: Math.round(b.bikeMi * 10) / 10,
    runMi: Math.round(b.runMi * 10) / 10,
  }));
}

export async function recentWorkouts(days = 14, now = new Date()): Promise<RecentWorkout[]> {
  const since = addDays(dayStart(now), -days + 1);
  const rows = await prisma.workout.findMany({
    where: { date: { gte: since } },
    orderBy: { date: "desc" },
  });
  return rows.map((w) => ({
    date: isoDay(new Date(w.date)),
    type: w.type,
    title: w.title,
    durationMin: w.durationMin,
    distance: w.distance,
    distanceUnit: w.distanceUnit,
    rpe: w.rpe,
    soreness: w.soreness,
    notes: w.notes ? truncate(w.notes, 240) : null,
  }));
}

export async function recentDailyHealth(days = 14, now = new Date()): Promise<RecentDailyHealth[]> {
  const since = addDays(dayStart(now), -days + 1);
  const rows = await prisma.dailyHealth.findMany({
    where: { date: { gte: since } },
    orderBy: { date: "desc" },
  });
  return rows.map((h) => ({
    date: isoDay(new Date(h.date)),
    steps: h.steps,
    restingHr: h.restingHr,
    avgHr: h.avgHr,
    stressAvg: h.stressAvg,
    intensityMin: h.intensityMin,
    bodyBatteryMin: h.bodyBatteryMin,
    bodyBatteryMax: h.bodyBatteryMax,
    hrvLastNightAvg: h.hrvLastNightAvg,
    hrvWeeklyAvg: h.hrvWeeklyAvg,
    hrvStatus: h.hrvStatus,
  }));
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}

export async function loadFlags(now = new Date()): Promise<LoadFlags> {
  const recent = await prisma.workout.findMany({
    where: { date: { gte: addDays(dayStart(now), -30) } },
    orderBy: { date: "desc" },
  });

  // Group by day (since multiple workouts can share a date)
  const byDay = new Map<string, { maxRpe: number; hasRest: boolean; soreness: number | null }>();
  for (const w of recent) {
    const d = isoDay(new Date(w.date));
    const e = byDay.get(d) ?? { maxRpe: 0, hasRest: false, soreness: null };
    if (w.rpe != null && w.rpe > e.maxRpe) e.maxRpe = w.rpe;
    if (w.type === "rest") e.hasRest = true;
    if (w.soreness != null && (e.soreness == null || w.soreness > e.soreness)) e.soreness = w.soreness;
    byDay.set(d, e);
  }

  // Consecutive hard days walking backward from today.
  let consecutiveHardDays = 0;
  for (let i = 0; i < 14; i++) {
    const d = isoDay(addDays(dayStart(now), -i));
    const e = byDay.get(d);
    if (!e || e.maxRpe < 7) break;
    consecutiveHardDays++;
  }

  let daysSinceRest = 0;
  for (let i = 0; i < 30; i++) {
    const d = isoDay(addDays(dayStart(now), -i));
    const e = byDay.get(d);
    if (e?.hasRest) break;
    daysSinceRest++;
  }

  // Soreness trend: compare last 7 days mean vs prior 7 days mean.
  const recentSoreness = avgSoreness(byDay, now, 0, 7);
  const priorSoreness = avgSoreness(byDay, now, 7, 14);
  let sorenessTrend: LoadFlags["sorenessTrend"] = "flat";
  if (recentSoreness != null && priorSoreness != null) {
    if (recentSoreness - priorSoreness > 0.75) sorenessTrend = "rising";
    else if (priorSoreness - recentSoreness > 0.75) sorenessTrend = "falling";
  }

  const swimSessionsLast14d = recent.filter((w) => {
    if (w.type !== "swim") return false;
    return new Date(w.date) >= addDays(dayStart(now), -13);
  }).length;

  return { consecutiveHardDays, daysSinceRest, sorenessTrend, swimSessionsLast14d };
}

function avgSoreness(
  byDay: Map<string, { soreness: number | null }>,
  now: Date,
  fromDaysAgo: number,
  toDaysAgo: number
): number | null {
  const vals: number[] = [];
  for (let i = fromDaysAgo; i < toDaysAgo; i++) {
    const d = isoDay(addDays(dayStart(now), -i));
    const v = byDay.get(d)?.soreness;
    if (v != null) vals.push(v);
  }
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export async function milestones(): Promise<Milestone[]> {
  const out: Milestone[] = [];
  const firstSwim = await prisma.workout.findFirst({
    where: { type: "swim" },
    orderBy: { date: "asc" },
  });
  if (firstSwim) out.push({ date: isoDay(new Date(firstSwim.date)), label: "First swim recorded" });

  const longestBike = await prisma.workout.findFirst({
    where: { type: "bike", distance: { not: null } },
    orderBy: { distance: "desc" },
  });
  if (longestBike?.distance) {
    out.push({
      date: isoDay(new Date(longestBike.date)),
      label: `Longest bike: ${longestBike.distance} ${longestBike.distanceUnit ?? ""}`,
    });
  }

  const longestRun = await prisma.workout.findFirst({
    where: { type: "run", distance: { not: null } },
    orderBy: { distance: "desc" },
  });
  if (longestRun?.distance) {
    out.push({
      date: isoDay(new Date(longestRun.date)),
      label: `Longest run: ${longestRun.distance} ${longestRun.distanceUnit ?? ""}`,
    });
  }

  return out.slice(0, 5);
}
