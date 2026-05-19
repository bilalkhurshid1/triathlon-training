"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { raceFormSchema } from "@/lib/validators";

function entries(formData: FormData) {
  const obj: Record<string, FormDataEntryValue> = {};
  for (const [k, v] of formData.entries()) obj[k] = v;
  return obj;
}

export async function updateRace(formData: FormData) {
  const parsed = raceFormSchema.parse(entries(formData));
  const data = {
    name: parsed.name,
    date: new Date(`${parsed.date}T00:00:00`),
    swimYards: parsed.swimYards,
    bikeMiles: parsed.bikeMiles,
    runMiles: parsed.runMiles,
    goals: parsed.goals,
    notes: parsed.notes,
    isPrimary: true,
  };
  if (parsed.id) {
    await prisma.race.update({ where: { id: parsed.id }, data });
  } else {
    await prisma.race.create({ data });
  }
  revalidatePath("/race");
  revalidatePath("/coach");
  revalidatePath("/");
}
