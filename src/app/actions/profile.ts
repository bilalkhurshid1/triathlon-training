"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { profileFormSchema } from "@/lib/validators";

function entries(formData: FormData) {
  const obj: Record<string, FormDataEntryValue> = {};
  for (const [k, v] of formData.entries()) obj[k] = v;
  return obj;
}

export async function updateProfile(formData: FormData) {
  const parsed = profileFormSchema.parse(entries(formData));
  await prisma.profile.upsert({
    where: { id: "me" },
    update: parsed,
    create: { id: "me", ...parsed },
  });
  revalidatePath("/profile");
  revalidatePath("/coach");
  revalidatePath("/");
}
