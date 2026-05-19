import { prisma } from "@/lib/db";
import { updateProfile } from "@/app/actions/profile";

const labelCls = "text-xs uppercase tracking-wide text-zinc-500";
const inputCls =
  "w-full rounded border border-zinc-300 px-2 py-1.5 text-sm bg-white focus:outline-none focus:border-zinc-500";
const taCls = `${inputCls} font-mono`;

const fields: { name: keyof Awaited<ReturnType<typeof loadProfile>>; label: string; help?: string }[] = [
  { name: "displayName", label: "Display name" },
  { name: "goals", label: "Goals" },
  { name: "weaknesses", label: "Weaknesses", help: "What the coach should pay extra attention to." },
  { name: "injuries", label: "Injuries / soreness" },
  { name: "trainingConstraints", label: "Training constraints", help: "Schedule, equipment, access." },
  { name: "assumptions", label: "Key assumptions", help: "Useful baselines the coach should know." },
  { name: "coachingPrefs", label: "Coaching preferences", help: "Tone, depth, format." },
  { name: "nutritionPrefs", label: "Nutrition preferences" },
];

async function loadProfile() {
  return (
    (await prisma.profile.findUnique({ where: { id: "me" } })) ?? {
      id: "me",
      displayName: null,
      goals: null,
      weaknesses: null,
      injuries: null,
      trainingConstraints: null,
      assumptions: null,
      coachingPrefs: null,
      nutritionPrefs: null,
      updatedAt: new Date(),
    }
  );
}

export default async function ProfilePage() {
  const profile = await loadProfile();
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="text-sm text-zinc-600">
          The coach reads this on every chat turn. Be concrete.
        </p>
      </div>
      <form action={updateProfile} className="space-y-4">
        {fields.map((f) => {
          const value = (profile[f.name] ?? "") as string;
          const isShort = f.name === "displayName";
          return (
            <div key={f.name}>
              <label className={labelCls} htmlFor={f.name}>
                {f.label}
              </label>
              {isShort ? (
                <input id={f.name} name={f.name} defaultValue={value} className={inputCls} />
              ) : (
                <textarea id={f.name} name={f.name} defaultValue={value} rows={3} className={taCls} />
              )}
              {f.help && <p className="text-xs text-zinc-500 mt-1">{f.help}</p>}
            </div>
          );
        })}
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
