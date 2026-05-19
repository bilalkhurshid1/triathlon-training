"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { workoutFormSchema } from "@/lib/validators";

function entries(formData: FormData) {
  const obj: Record<string, FormDataEntryValue> = {};
  for (const [k, v] of formData.entries()) obj[k] = v;
  return obj;
}

export async function createWorkout(formData: FormData) {
  const parsed = workoutFormSchema.parse(entries(formData));
  await prisma.workout.create({
    data: {
      date: new Date(`${parsed.date}T00:00:00`),
      type: parsed.type,
      title: parsed.title,
      durationMin: parsed.durationMin,
      distance: parsed.distance,
      distanceUnit: parsed.distanceUnit,
      rpe: parsed.rpe,
      soreness: parsed.soreness,
      notes: parsed.notes,
      source: "manual",
    },
  });
  revalidatePath("/workouts");
  revalidatePath("/");
  redirect("/workouts");
}

export async function updateWorkout(id: string, formData: FormData) {
  const parsed = workoutFormSchema.parse(entries(formData));
  await prisma.workout.update({
    where: { id },
    data: {
      date: new Date(`${parsed.date}T00:00:00`),
      type: parsed.type,
      title: parsed.title,
      durationMin: parsed.durationMin,
      distance: parsed.distance,
      distanceUnit: parsed.distanceUnit,
      rpe: parsed.rpe,
      soreness: parsed.soreness,
      notes: parsed.notes,
    },
  });
  revalidatePath("/workouts");
  revalidatePath(`/workouts/${id}/edit`);
  revalidatePath("/");
  redirect("/workouts");
}

export async function deleteWorkout(id: string) {
  "use server";
  await prisma.workout.delete({ where: { id } });
  revalidatePath("/workouts");
  revalidatePath("/");
  redirect("/workouts");
}
