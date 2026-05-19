"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { settingsFormSchema } from "@/lib/validators";

function entries(formData: FormData) {
  const obj: Record<string, FormDataEntryValue> = {};
  for (const [k, v] of formData.entries()) obj[k] = v;
  return obj;
}

export async function updateSettings(formData: FormData) {
  const parsed = settingsFormSchema.parse(entries(formData));
  await prisma.settings.upsert({
    where: { id: "default" },
    update: parsed,
    create: { id: "default", ...parsed },
  });
  revalidatePath("/settings");
  revalidatePath("/coach");
}
