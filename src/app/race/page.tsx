import { prisma } from "@/lib/db";
import { updateRace } from "@/app/actions/race";
import { isoDay, daysUntil } from "@/lib/dates";

const labelCls = "text-xs uppercase tracking-wide text-zinc-500";
const inputCls =
  "w-full rounded border border-zinc-300 px-2 py-1.5 text-sm bg-white focus:outline-none focus:border-zinc-500";

export default async function RacePage() {
  const race = await prisma.race.findFirst({ where: { isPrimary: true } });
  const days = race ? daysUntil(new Date(race.date)) : null;

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Race</h1>
        {race && days !== null && (
          <p className="text-sm text-zinc-600">
            {days >= 0 ? `${days} days away` : `${-days} days ago`} ({isoDay(new Date(race.date))})
          </p>
        )}
      </div>

      <form action={updateRace} className="space-y-4">
        {race && <input type="hidden" name="id" value={race.id} />}

        <div>
          <label className={labelCls}>Name</label>
          <input name="name" required defaultValue={race?.name ?? ""} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Date</label>
          <input
            type="date"
            name="date"
            required
            defaultValue={race ? isoDay(new Date(race.date)) : ""}
            className={inputCls}
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Swim (yards)</label>
            <input
              type="number"
              name="swimYards"
              min={0}
              defaultValue={race?.swimYards ?? ""}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Bike (miles)</label>
            <input
              type="number"
              step="0.01"
              name="bikeMiles"
              min={0}
              defaultValue={race?.bikeMiles ?? ""}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Run (miles)</label>
            <input
              type="number"
              step="0.01"
              name="runMiles"
              min={0}
              defaultValue={race?.runMiles ?? ""}
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>Goals</label>
          <textarea
            name="goals"
            rows={3}
            defaultValue={race?.goals ?? ""}
            className={`${inputCls} font-mono`}
          />
        </div>

        <div>
          <label className={labelCls}>Notes</label>
          <textarea
            name="notes"
            rows={3}
            defaultValue={race?.notes ?? ""}
            className={`${inputCls} font-mono`}
          />
        </div>

        <button
          type="submit"
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          Save
        </button>
      </form>
    </div>
  );
}
