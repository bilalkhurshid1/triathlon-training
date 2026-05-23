import { syncGarminFromConfiguredPath } from "@/lib/importers/garmin-db";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (provider === "garmin") {
    try {
      const result = await syncGarminFromConfiguredPath();
      return Response.json({
        importId: result.importId,
        workoutsCreated: result.workoutsCreated,
        workoutsUpdated: result.workoutsUpdated,
        healthCreated: result.healthCreated,
        healthUpdated: result.healthUpdated,
        skippedActivities: result.skippedActivities,
      });
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : "Garmin sync failed" },
        { status: 400 }
      );
    }
  }

  return Response.json(
    { error: `'${provider}' sync not implemented`, hint: "Coming after the MVP." },
    { status: 501 }
  );
}
