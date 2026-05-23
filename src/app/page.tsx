import Link from "next/link";
import { prisma } from "@/lib/db";
import { daysUntil, isoDay } from "@/lib/dates";
import { loadFlags, recentDailyHealth, recentWorkouts, weeklyTotals } from "@/lib/coach/summaries";

export default async function DashboardPage() {
  const now = new Date();
  const [race, weeks, recent, health, flags] = await Promise.all([
    prisma.race.findFirst({ where: { isPrimary: true } }),
    weeklyTotals(4, now),
    recentWorkouts(7, now),
    recentDailyHealth(7, now),
    loadFlags(now),
  ]);
  const thisWeek = weeks[weeks.length - 1];
  const latestHealth = health[0];

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        {race ? (
          <p className="text-sm text-zinc-600">
            <Link href="/race" className="underline">
              {race.name}
            </Link>{" "}
            — {daysUntil(new Date(race.date), now)} days to go ({isoDay(new Date(race.date))})
          </p>
        ) : (
          <p className="text-sm text-zinc-600">
            No race set. <Link href="/race" className="underline">Add one</Link>.
          </p>
        )}
      </header>

      <section className="grid gap-3 sm:grid-cols-2">
        <Card title="This week">
          {thisWeek ? (
            <ul className="text-sm space-y-1">
              <li>swim: {thisWeek.swimYd} yd</li>
              <li>bike: {thisWeek.bikeMi} mi</li>
              <li>run: {thisWeek.runMi} mi</li>
              <li>lift sessions: {thisWeek.liftSessions}</li>
              <li>rest days: {thisWeek.restDays}</li>
              <li>total time: {thisWeek.totalDurationMin} min</li>
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">No data this week.</p>
          )}
        </Card>

        <Card title="Load flags">
          <ul className="text-sm space-y-1">
            <li>consecutive hard days (RPE≥7): {flags.consecutiveHardDays}</li>
            <li>days since last rest: {flags.daysSinceRest}</li>
            <li>soreness trend: {flags.sorenessTrend}</li>
            <li>swim sessions (last 14d): {flags.swimSessionsLast14d}</li>
          </ul>
        </Card>

        <Card title="Garmin health">
          {latestHealth ? (
            <ul className="text-sm space-y-1">
              <li>latest day: {latestHealth.date}</li>
              <li>resting HR: {latestHealth.restingHr != null ? Math.round(latestHealth.restingHr) : "—"} bpm</li>
              <li>HRV: {latestHealth.hrvLastNightAvg != null ? Math.round(latestHealth.hrvLastNightAvg) : "—"} ms</li>
              <li>stress: {latestHealth.stressAvg != null ? Math.round(latestHealth.stressAvg) : "—"}</li>
              <li>
                body battery: {latestHealth.bodyBatteryMin ?? "—"}-{latestHealth.bodyBatteryMax ?? "—"}
              </li>
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">
              No Garmin health data. <Link href="/integrations" className="underline">Sync Garmin</Link>.
            </p>
          )}
        </Card>
      </section>

      <section>
        <Card title="Last 7 days">
          {recent.length === 0 ? (
            <p className="text-sm text-zinc-500">Nothing logged.</p>
          ) : (
            <ul className="text-sm divide-y divide-zinc-100">
              {recent.map((r, i) => (
                <li key={i} className="py-1.5">
                  <span className="font-mono text-zinc-500 mr-2">{r.date}</span>
                  <Link href={`/workouts/${r.id}`} className="font-medium mr-2 hover:underline">
                    {r.type}
                  </Link>
                  {r.title && (
                    <Link href={`/workouts/${r.id}`} className="text-zinc-700 hover:underline">
                      {r.title}
                    </Link>
                  )}
                  <span className="ml-2 text-zinc-500">
                    {r.distance != null ? `${r.distance}${r.distanceUnit ?? ""} ` : ""}
                    {r.durationMin != null ? `${r.durationMin}m ` : ""}
                    {r.rpe != null ? `RPE ${r.rpe}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <section>
        <Card title="Weekly totals (last 4 weeks)">
          <div className="overflow-x-auto">
            <table className="text-sm w-full">
              <thead className="text-left text-zinc-500">
                <tr>
                  <th className="py-1 pr-3">week</th>
                  <th className="py-1 pr-3">swim (yd)</th>
                  <th className="py-1 pr-3">bike (mi)</th>
                  <th className="py-1 pr-3">run (mi)</th>
                  <th className="py-1 pr-3">lift</th>
                  <th className="py-1 pr-3">rest</th>
                  <th className="py-1 pr-3">time</th>
                </tr>
              </thead>
              <tbody>
                {weeks.map((w) => (
                  <tr key={w.weekStart} className="border-t border-zinc-100">
                    <td className="py-1 pr-3 font-mono">{w.weekStart}</td>
                    <td className="py-1 pr-3">{w.swimYd}</td>
                    <td className="py-1 pr-3">{w.bikeMi}</td>
                    <td className="py-1 pr-3">{w.runMi}</td>
                    <td className="py-1 pr-3">{w.liftSessions}</td>
                    <td className="py-1 pr-3">{w.restDays}</td>
                    <td className="py-1 pr-3">{w.totalDurationMin}m</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-zinc-200 bg-white p-4">
      <h2 className="text-xs uppercase tracking-wide text-zinc-500 mb-2">{title}</h2>
      {children}
    </div>
  );
}
