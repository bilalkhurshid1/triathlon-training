import type { CoachContext } from "@/lib/coach/context";

function line(s: string | null | undefined): string | null {
  if (!s) return null;
  return s.replace(/\s+/g, " ").trim();
}

export function contextToMarkdown(ctx: CoachContext): string {
  const out: string[] = [];

  out.push("## Athlete context");
  out.push(`- Today: ${ctx.today}`);
  if (ctx.race) {
    out.push(
      `- Race: ${ctx.race.name} on ${ctx.race.date} (${ctx.race.daysUntil} days away)`
    );
    const parts: string[] = [];
    if (ctx.race.swimYards != null) parts.push(`${ctx.race.swimYards}yd swim`);
    if (ctx.race.bikeMiles != null) parts.push(`${ctx.race.bikeMiles}mi bike`);
    if (ctx.race.runMiles != null) parts.push(`${ctx.race.runMiles}mi run`);
    if (parts.length) out.push(`- Distances: ${parts.join(" · ")}`);
    if (ctx.race.goals) out.push(`- Race goals: ${line(ctx.race.goals)}`);
  } else {
    out.push("- Race: (not set)");
  }

  if (ctx.profile.goals) out.push(`- Goals: ${line(ctx.profile.goals)}`);
  if (ctx.profile.weaknesses) out.push(`- Weaknesses: ${line(ctx.profile.weaknesses)}`);
  if (ctx.profile.injuries) out.push(`- Injuries / soreness: ${line(ctx.profile.injuries)}`);
  if (ctx.profile.constraints) out.push(`- Constraints: ${line(ctx.profile.constraints)}`);
  if (ctx.profile.assumptions) out.push(`- Assumptions: ${line(ctx.profile.assumptions)}`);
  if (ctx.profile.coachingPrefs) out.push(`- Coaching prefs: ${line(ctx.profile.coachingPrefs)}`);

  out.push("");
  out.push("## Last 4 weeks (Mon-start)");
  for (const w of ctx.weeklyTotals) {
    out.push(
      `- ${w.weekStart}: swim ${w.swimYd}yd · bike ${w.bikeMi}mi · run ${w.runMi}mi · lift ${w.liftSessions} · rest ${w.restDays} · total ${w.totalDurationMin}m`
    );
  }

  out.push("");
  out.push("## Last 14 days (recent first)");
  if (ctx.recentWorkouts.length === 0) {
    out.push("- (no workouts logged in the last 14 days)");
  } else {
    for (const r of ctx.recentWorkouts) {
      const seg: string[] = [`${r.date} ${r.type}`];
      if (r.title) seg.push(`"${r.title}"`);
      const metric: string[] = [];
      if (r.distance != null) metric.push(`${r.distance}${r.distanceUnit ?? ""}`);
      if (r.durationMin != null) metric.push(`${r.durationMin}m`);
      if (r.rpe != null) metric.push(`RPE ${r.rpe}`);
      if (r.soreness != null) metric.push(`soreness ${r.soreness}`);
      if (metric.length) seg.push(metric.join(", "));
      if (r.garminSplit) seg.push(`Garmin split: ${r.garminSplit}`);
      if (r.notes) seg.push(`notes: ${line(r.notes)}`);
      out.push(`- ${seg.join(" — ")}`);
    }
  }

  out.push("");
  out.push("## Last 14 days Garmin health (recent first)");
  if (ctx.recentDailyHealth.length === 0) {
    out.push("- (no Garmin health data imported in the last 14 days)");
  } else {
    for (const h of ctx.recentDailyHealth) {
      const metric: string[] = [];
      if (h.restingHr != null) metric.push(`RHR ${Math.round(h.restingHr)}bpm`);
      if (h.hrvLastNightAvg != null) metric.push(`HRV ${Math.round(h.hrvLastNightAvg)}ms`);
      if (h.hrvStatus) metric.push(`HRV status ${h.hrvStatus}`);
      if (h.stressAvg != null) metric.push(`stress ${Math.round(h.stressAvg)}`);
      if (h.bodyBatteryMin != null || h.bodyBatteryMax != null) {
        metric.push(`body battery ${h.bodyBatteryMin ?? "?"}-${h.bodyBatteryMax ?? "?"}`);
      }
      if (h.steps != null) metric.push(`steps ${h.steps}`);
      if (h.intensityMin != null) metric.push(`intensity ${h.intensityMin}m`);
      out.push(`- ${h.date}: ${metric.length ? metric.join(" · ") : "no metrics"}`);
    }
  }

  out.push("");
  out.push("## Load flags");
  out.push(`- Consecutive hard days (RPE>=7): ${ctx.loadFlags.consecutiveHardDays}`);
  out.push(`- Days since last rest day: ${ctx.loadFlags.daysSinceRest}`);
  out.push(`- Soreness trend (last 7d vs prior 7d): ${ctx.loadFlags.sorenessTrend}`);
  out.push(`- Swim sessions in last 14 days: ${ctx.loadFlags.swimSessionsLast14d}`);

  if (ctx.milestones.length) {
    out.push("");
    out.push("## Milestones");
    for (const m of ctx.milestones) out.push(`- ${m.date}: ${m.label}`);
  }

  return out.join("\n");
}
