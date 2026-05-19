import { WORKOUT_TYPES, DISTANCE_UNITS } from "@/lib/validators";
import type { Workout } from "@/generated/prisma/client";
import { isoDay } from "@/lib/dates";

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  workout?: Pick<
    Workout,
    | "date"
    | "type"
    | "title"
    | "durationMin"
    | "distance"
    | "distanceUnit"
    | "rpe"
    | "soreness"
    | "notes"
  >;
  submitLabel?: string;
  deleteAction?: () => void | Promise<void>;
};

const labelCls = "text-xs uppercase tracking-wide text-zinc-500";
const inputCls =
  "w-full rounded border border-zinc-300 px-2 py-1.5 text-sm bg-white focus:outline-none focus:border-zinc-500";

export function WorkoutForm({ action, workout, submitLabel = "Save", deleteAction }: Props) {
  const today = isoDay(new Date());
  return (
    <form action={action} className="grid gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Date</label>
          <input
            type="date"
            name="date"
            required
            defaultValue={workout ? isoDay(new Date(workout.date)) : today}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Type</label>
          <select name="type" defaultValue={workout?.type ?? "run"} className={inputCls}>
            {WORKOUT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelCls}>Title</label>
        <input
          name="title"
          defaultValue={workout?.title ?? ""}
          placeholder="e.g. tempo run, swim drills"
          className={inputCls}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelCls}>Duration (min)</label>
          <input
            type="number"
            name="durationMin"
            min={0}
            defaultValue={workout?.durationMin ?? ""}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Distance</label>
          <input
            type="number"
            step="0.01"
            name="distance"
            min={0}
            defaultValue={workout?.distance ?? ""}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Unit</label>
          <select name="distanceUnit" defaultValue={workout?.distanceUnit ?? ""} className={inputCls}>
            <option value="">—</option>
            {DISTANCE_UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>RPE (1–10)</label>
          <input
            type="number"
            name="rpe"
            min={1}
            max={10}
            defaultValue={workout?.rpe ?? ""}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Soreness (1–10)</label>
          <input
            type="number"
            name="soreness"
            min={1}
            max={10}
            defaultValue={workout?.soreness ?? ""}
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <label className={labelCls}>Notes</label>
        <textarea
          name="notes"
          rows={4}
          defaultValue={workout?.notes ?? ""}
          className={`${inputCls} font-mono`}
        />
      </div>

      <div className="flex items-center justify-between pt-2">
        <button
          type="submit"
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          {submitLabel}
        </button>
        {deleteAction && (
          <form action={deleteAction}>
            <button
              type="submit"
              className="rounded border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50"
            >
              Delete
            </button>
          </form>
        )}
      </div>
    </form>
  );
}
