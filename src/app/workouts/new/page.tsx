import { WorkoutForm } from "@/components/workout-form";
import { createWorkout } from "@/app/actions/workouts";

export default function NewWorkoutPage() {
  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold">Add workout</h1>
      <WorkoutForm action={createWorkout} submitLabel="Create" />
    </div>
  );
}
