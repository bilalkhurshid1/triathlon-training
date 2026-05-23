"use server";

import { revalidatePath } from "next/cache";
import {
  syncGarminFromConfiguredPath,
  updateGarminSourcePath,
} from "@/lib/importers/garmin-db";
import { integrationConfigSchema } from "@/lib/validators";

export async function updateGarminIntegration(formData: FormData) {
  const parsed = integrationConfigSchema.parse({
    sourcePath: formData.get("sourcePath"),
  });

  await updateGarminSourcePath(parsed.sourcePath);
  revalidateIntegrationPaths();
}

export async function syncGarminIntegration() {
  try {
    await syncGarminFromConfiguredPath();
  } catch {
    // The importer stores the error message on IntegrationConfig for the page to render.
  }
  revalidateIntegrationPaths();
}

function revalidateIntegrationPaths() {
  revalidatePath("/");
  revalidatePath("/workouts");
  revalidatePath("/integrations");
  revalidatePath("/coach/debug");
}
