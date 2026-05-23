import Link from "next/link";
import { prisma } from "@/lib/db";
import { WORKOUT_TYPES } from "@/lib/validators";
import { isoDay } from "@/lib/dates";

type SearchParams = Promise<{ type?: string }>;

export default async function WorkoutsPage({ searchParams }: { searchParams: SearchParams }) {
  const { type } = await searchParams;
  const filter = type && (WORKOUT_TYPES as readonly string[]).includes(type) ? type : undefined;

  const workouts = await prisma.workout.findMany({
    where: filter ? { type: filter } : undefined,
    orderBy: { date: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Workouts</h1>
        <Link
          href="/workouts/new"
          className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700"
        >
          + Add workout
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-1 text-sm">
        <Link
          href="/workouts"
          className={`px-2 py-1 rounded ${!filter ? "bg-zinc-200" : "hover:bg-zinc-100"}`}
        >
          all
        </Link>
        {WORKOUT_TYPES.map((t) => (
          <Link
            key={t}
            href={`/workouts?type=${t}`}
            className={`px-2 py-1 rounded ${
              filter === t ? "bg-zinc-200" : "hover:bg-zinc-100"
            }`}
          >
            {t}
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Distance</th>
              <th className="px-3 py-2">Duration</th>
              <th className="px-3 py-2">RPE</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {workouts.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-zinc-500" colSpan={7}>
                  No workouts yet.
                </td>
              </tr>
            )}
            {workouts.map((w) => (
              <tr key={w.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                <td className="px-3 py-2 whitespace-nowrap">
                  <Link href={`/workouts/${w.id}`} className="font-mono text-zinc-700 hover:text-zinc-950">
                    {isoDay(new Date(w.date))}
                  </Link>
                </td>
                <td className="px-3 py-2">{w.type}</td>
                <td className="px-3 py-2">
                  <Link href={`/workouts/${w.id}`} className="font-medium text-zinc-900 hover:underline">
                    {w.title ?? "Untitled workout"}
                  </Link>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {w.distance != null ? `${w.distance} ${w.distanceUnit ?? ""}` : "—"}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {w.durationMin != null ? `${w.durationMin}m` : "—"}
                </td>
                <td className="px-3 py-2">{w.rpe ?? "—"}</td>
                <td className="px-3 py-2 space-x-3">
                  <Link
                    href={`/workouts/${w.id}`}
                    className="text-zinc-600 hover:text-zinc-900 underline"
                  >
                    view
                  </Link>
                  <Link
                    href={`/workouts/${w.id}/edit`}
                    className="text-zinc-600 hover:text-zinc-900 underline"
                  >
                    edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
