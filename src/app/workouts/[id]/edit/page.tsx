import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { WorkoutForm } from "@/components/workout-form";
import { updateWorkout, deleteWorkout } from "@/app/actions/workouts";

type Params = Promise<{ id: string }>;

export default async function EditWorkoutPage({ params }: { params: Params }) {
  const { id } = await params;
  const workout = await prisma.workout.findUnique({ where: { id } });
  if (!workout) return notFound();

  const update = updateWorkout.bind(null, id);
  const remove = deleteWorkout.bind(null, id);

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold">Edit workout</h1>
      <WorkoutForm action={update} workout={workout} submitLabel="Save" deleteAction={remove} />
    </div>
  );
}
