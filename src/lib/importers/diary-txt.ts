import { prisma } from "@/lib/db";
import { isoDay, parseShortDate } from "@/lib/dates";
import {
  detectSport,
  extractDistance,
  extractDurationMin,
  extractPaceSecPerMi,
  extractSpeedMph,
  splitActivities,
} from "@/lib/importers/shared";

type DayBlock = {
  shortDate: string;
  line: string;
  notes: string[];
};

function parseBlocks(raw: string): DayBlock[] {
  const blocks: DayBlock[] = [];
  let current: DayBlock | null = null;
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const dateMatch = line.match(/^(\d{1,2}\/\d{1,2})\s*[-–—:]\s*(.*)$/);
    if (dateMatch) {
      if (current) blocks.push(current);
      current = { shortDate: dateMatch[1], line: dateMatch[2], notes: [] };
      continue;
    }
    if (current && /^notes?\s*:/i.test(line)) {
      current.notes.push(line.replace(/^notes?\s*:\s*/i, ""));
      continue;
    }
    // Unmatched continuation lines: attach to current block as notes
    if (current) current.notes.push(line);
  }
  if (current) blocks.push(current);
  return blocks;
}

export type ImportResult = {
  importId: string;
  daysParsed: number;
  workoutsCreated: number;
  workoutsUpdated: number;
  unrecognized: Array<{ date: string; text: string }>;
};

export async function importDiaryTxt(rawText: string, referenceYear?: number): Promise<ImportResult> {
  const now = new Date();
  const year = referenceYear ?? now.getFullYear();

  // Idempotent re-import: drop any previously imported file_import workouts.
  // (Manual entries with source='manual' are untouched.)
  await prisma.workout.deleteMany({ where: { source: "file_import" } });

  const importRecord = await prisma.activityImport.create({
    data: { source: "manual_txt", rawText, parsedAt: new Date() },
  });

  const blocks = parseBlocks(rawText);
  let workoutsCreated = 0;
  let workoutsUpdated = 0;
  const unrecognized: ImportResult["unrecognized"] = [];

  for (const block of blocks) {
    const date = parseShortDate(block.shortDate, year, now);
    if (!date) {
      unrecognized.push({ date: block.shortDate, text: block.line });
      continue;
    }

    const activities = splitActivities(block.line);
    const notesBlock = block.notes.join("\n").trim();

    for (let i = 0; i < activities.length; i++) {
      const activity = activities[i];
      const type = detectSport(activity);
      const distance = extractDistance(activity);
      const durationMin = extractDurationMin(activity);
      const speedMph = extractSpeedMph(activity);
      const paceSecPerMi = extractPaceSecPerMi(activity);

      const isFirstActivity = i === 0;
      const notesPieces: string[] = [];
      notesPieces.push(activity);
      if (isFirstActivity && notesBlock) notesPieces.push(`[notes] ${notesBlock}`);
      const notes = notesPieces.join("\n\n");

      const externalId = `diary-txt:${isoDay(date)}:${i}`;

      const upserted = await prisma.workout.upsert({
        where: { source_externalId: { source: "file_import", externalId } },
        update: {
          date,
          type,
          title: type === "other" ? activity.slice(0, 60) : titleFromActivity(activity, type),
          durationMin,
          distance: distance?.distance ?? null,
          distanceUnit: distance?.unit ?? null,
          notes,
          importId: importRecord.id,
        },
        create: {
          date,
          type,
          title: type === "other" ? activity.slice(0, 60) : titleFromActivity(activity, type),
          durationMin,
          distance: distance?.distance ?? null,
          distanceUnit: distance?.unit ?? null,
          notes,
          source: "file_import",
          externalId,
          importId: importRecord.id,
        },
      });

      // Replace metrics for idempotent re-import
      await prisma.workoutMetric.deleteMany({ where: { workoutId: upserted.id } });
      const metricsData: { workoutId: string; key: string; valueNum: number; unit: string }[] = [];
      if (speedMph != null)
        metricsData.push({ workoutId: upserted.id, key: "avg_speed_mph", valueNum: speedMph, unit: "mph" });
      if (paceSecPerMi != null)
        metricsData.push({
          workoutId: upserted.id,
          key: "avg_pace_s_per_mi",
          valueNum: paceSecPerMi,
          unit: "s/mi",
        });
      if (metricsData.length) await prisma.workoutMetric.createMany({ data: metricsData });

      if (upserted.createdAt.getTime() === upserted.updatedAt.getTime()) workoutsCreated++;
      else workoutsUpdated++;

      if (type === "other") unrecognized.push({ date: isoDay(date), text: activity });
    }
  }

  return {
    importId: importRecord.id,
    daysParsed: blocks.length,
    workoutsCreated,
    workoutsUpdated,
    unrecognized,
  };
}

function titleFromActivity(activity: string, type: string): string {
  // Drop parens (lift lists go to notes), drop the metrics tail, trim debris.
  const noParens = activity.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s{2,}/g, " ");
  const firstDigit = noParens.search(/\d/);
  const cut = firstDigit > 0 ? noParens.slice(0, firstDigit) : noParens;
  const head = cut
    .replace(/^(and\s+|then\s+|followed\s+by\s+)+/i, "")
    .replace(/[\s:,.\-–—]+$/g, "")
    .trim();
  if (head.length >= 4 && head.length <= 60) return head;
  return `${type} session`;
}
