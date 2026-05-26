import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { prisma } from "@/lib/db";
import { isoDay } from "@/lib/dates";

export const GARMIN_PROVIDER = "garmin";
export const GARMIN_WORKOUT_SOURCE = "garmin";
export const GARMIN_IMPORT_SOURCE = "garmin_db";
export const DEFAULT_GARMIN_DB_DIR = "~/HealthData/DBs";

const REQUIRED_GARMIN_DB_FILES = [
  "garmin_activities.db",
  "garmin_summary.db",
  "garmin.db",
] as const;

type RequiredGarminDbFile = (typeof REQUIRED_GARMIN_DB_FILES)[number];
type MeasurementSystem = "metric" | "statute";

export type GarminFileStatus = {
  name: RequiredGarminDbFile;
  path: string;
  exists: boolean;
  modifiedAt: Date | null;
};

export type GarminIntegrationStatus = {
  config: {
    sourcePath: string | null;
    lastSyncAt: Date | null;
    lastSyncStatus: string | null;
    lastSyncMessage: string | null;
  } | null;
  sourcePath: string;
  expandedSourcePath: string;
  files: GarminFileStatus[];
  latestSourceModifiedAt: Date | null;
  ready: boolean;
};

export type GarminMetricDraft = {
  key: string;
  valueNum?: number | null;
  valueText?: string | null;
  unit?: string | null;
};

export type ParsedGarminWorkout = {
  externalId: string;
  date: Date;
  type: string;
  title: string;
  durationMin: number | null;
  distance: number | null;
  distanceUnit: string | null;
  notes: string | null;
  metrics: GarminMetricDraft[];
};

export type ParsedGarminDailyHealth = {
  date: Date;
  steps: number | null;
  restingHr: number | null;
  avgHr: number | null;
  minHr: number | null;
  maxHr: number | null;
  stressAvg: number | null;
  intensityMin: number | null;
  caloriesActive: number | null;
  caloriesBmr: number | null;
  bodyBatteryMin: number | null;
  bodyBatteryMax: number | null;
  spo2Avg: number | null;
  respirationAvg: number | null;
  hrvLastNightAvg: number | null;
  hrvWeeklyAvg: number | null;
  hrvStatus: string | null;
  weight: number | null;
  weightUnit: string | null;
};

export type GarminDbReadResult = {
  sourceDir: string;
  files: GarminFileStatus[];
  workouts: ParsedGarminWorkout[];
  dailyHealth: ParsedGarminDailyHealth[];
  skippedActivities: number;
};

export type GarminImportResult = GarminDbReadResult & {
  importId: string;
  workoutsCreated: number;
  workoutsUpdated: number;
  healthCreated: number;
  healthUpdated: number;
};

type GarminActivityRow = Record<string, unknown>;
type GarminRecordRow = Record<string, unknown>;
type GarminDailySummaryRow = Record<string, unknown>;
type GarminHrvRow = Record<string, unknown>;

export class GarminDbImportError extends Error {
  constructor(message: string, readonly missingFiles: GarminFileStatus[] = []) {
    super(message);
    this.name = "GarminDbImportError";
  }
}

export function expandGarminDbPath(input: string | null | undefined): string {
  const sourcePath = input?.trim() || DEFAULT_GARMIN_DB_DIR;
  if (sourcePath === "~") return os.homedir();
  if (sourcePath.startsWith("~/")) return path.join(os.homedir(), sourcePath.slice(2));
  return path.resolve(/* turbopackIgnore: true */ sourcePath);
}

export function getGarminRequiredFileStatuses(sourcePath: string | null | undefined): GarminFileStatus[] {
  const sourceDir = expandGarminDbPath(sourcePath);
  return REQUIRED_GARMIN_DB_FILES.map((name) => {
    const filePath = path.join(/* turbopackIgnore: true */ sourceDir, name);
    try {
      const stat = fs.statSync(/* turbopackIgnore: true */ filePath);
      return { name, path: filePath, exists: true, modifiedAt: stat.mtime };
    } catch {
      return { name, path: filePath, exists: false, modifiedAt: null };
    }
  });
}

export async function getGarminIntegrationStatus(): Promise<GarminIntegrationStatus> {
  const config = await prisma.integrationConfig.findUnique({
    where: { provider: GARMIN_PROVIDER },
    select: {
      sourcePath: true,
      lastSyncAt: true,
      lastSyncStatus: true,
      lastSyncMessage: true,
    },
  });
  const sourcePath = config?.sourcePath ?? DEFAULT_GARMIN_DB_DIR;
  const expandedSourcePath = expandGarminDbPath(sourcePath);
  const files = getGarminRequiredFileStatuses(sourcePath);

  return {
    config,
    sourcePath,
    expandedSourcePath,
    files,
    latestSourceModifiedAt: latestModifiedAt(files),
    ready: files.every((file) => file.exists),
  };
}

function latestModifiedAt(files: GarminFileStatus[]): Date | null {
  const latestMs = Math.max(...files.map((file) => file.modifiedAt?.getTime() ?? Number.NEGATIVE_INFINITY));
  return Number.isFinite(latestMs) ? new Date(latestMs) : null;
}

export async function updateGarminSourcePath(sourcePath: string | null): Promise<void> {
  await prisma.integrationConfig.upsert({
    where: { provider: GARMIN_PROVIDER },
    update: { sourcePath },
    create: { provider: GARMIN_PROVIDER, sourcePath },
  });
}

export async function syncGarminFromConfiguredPath(): Promise<GarminImportResult> {
  const config = await prisma.integrationConfig.upsert({
    where: { provider: GARMIN_PROVIDER },
    update: {
      lastSyncStatus: "running",
      lastSyncMessage: "Sync started.",
    },
    create: {
      provider: GARMIN_PROVIDER,
      sourcePath: DEFAULT_GARMIN_DB_DIR,
      lastSyncStatus: "running",
      lastSyncMessage: "Sync started.",
    },
  });

  try {
    const result = await importGarminDb(config.sourcePath ?? DEFAULT_GARMIN_DB_DIR);
    await prisma.integrationConfig.update({
      where: { provider: GARMIN_PROVIDER },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: "success",
        lastSyncMessage: `Imported ${result.workoutsCreated} new workouts, updated ${result.workoutsUpdated}, and synced ${result.dailyHealth.length} health days.`,
      },
    });
    return result;
  } catch (error) {
    await prisma.integrationConfig.update({
      where: { provider: GARMIN_PROVIDER },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: "error",
        lastSyncMessage: errorMessage(error),
      },
    });
    throw error;
  }
}

export function readGarminDbExport(sourcePath: string | null | undefined): GarminDbReadResult {
  const sourceDir = expandGarminDbPath(sourcePath);
  const files = getGarminRequiredFileStatuses(sourceDir);
  const missingFiles = files.filter((file) => !file.exists);
  if (missingFiles.length > 0) {
    throw new GarminDbImportError(
      `Missing GarminDB file${missingFiles.length === 1 ? "" : "s"}: ${missingFiles
        .map((file) => file.name)
        .join(", ")}`,
      missingFiles
    );
  }

  const garminDbPath = path.join(/* turbopackIgnore: true */ sourceDir, "garmin.db");
  const activitiesDbPath = path.join(/* turbopackIgnore: true */ sourceDir, "garmin_activities.db");
  const summaryDbPath = path.join(/* turbopackIgnore: true */ sourceDir, "garmin_summary.db");

  const measurementSystem = withReadonlyDb(garminDbPath, readMeasurementSystem);
  const hrvByDay = withReadonlyDb(garminDbPath, readHrvByDay);
  const { workouts, skippedActivities } = withReadonlyDb(activitiesDbPath, (db) =>
    readActivities(db, measurementSystem)
  );
  const dailyHealth = withReadonlyDb(summaryDbPath, (db) =>
    readDailyHealth(db, hrvByDay, measurementSystem)
  );

  return { sourceDir, files, workouts, dailyHealth, skippedActivities };
}

export async function importGarminDb(sourcePath: string | null | undefined): Promise<GarminImportResult> {
  const parsed = readGarminDbExport(sourcePath);
  const now = new Date();
  const importRecord = await prisma.activityImport.create({
    data: {
      source: GARMIN_IMPORT_SOURCE,
      rawFilePath: parsed.sourceDir,
      rawJson: JSON.stringify({
        files: parsed.files.map((file) => ({ name: file.name, path: file.path })),
        workouts: parsed.workouts.length,
        dailyHealth: parsed.dailyHealth.length,
        skippedActivities: parsed.skippedActivities,
      }),
      parsedAt: now,
    },
  });

  const existingWorkoutIds = new Set(
    (
      await prisma.workout.findMany({
        where: { source: GARMIN_WORKOUT_SOURCE },
        select: { externalId: true },
      })
    )
      .map((workout) => workout.externalId)
      .filter((externalId): externalId is string => externalId != null)
  );

  const existingHealthDays = new Set(
    (
      await prisma.dailyHealth.findMany({
        where: { source: GARMIN_WORKOUT_SOURCE },
        select: { date: true },
      })
    ).map((health) => isoDay(new Date(health.date)))
  );

  let workoutsCreated = 0;
  let workoutsUpdated = 0;
  let healthCreated = 0;
  let healthUpdated = 0;

  for (const workout of parsed.workouts) {
    if (existingWorkoutIds.has(workout.externalId)) workoutsUpdated++;
    else {
      workoutsCreated++;
      existingWorkoutIds.add(workout.externalId);
    }

    const saved = await prisma.workout.upsert({
      where: {
        source_externalId: {
          source: GARMIN_WORKOUT_SOURCE,
          externalId: workout.externalId,
        },
      },
      update: {
        date: workout.date,
        type: workout.type,
        title: workout.title,
        durationMin: workout.durationMin,
        distance: workout.distance,
        distanceUnit: workout.distanceUnit,
        importId: importRecord.id,
      },
      create: {
        date: workout.date,
        type: workout.type,
        title: workout.title,
        durationMin: workout.durationMin,
        distance: workout.distance,
        distanceUnit: workout.distanceUnit,
        notes: workout.notes,
        source: GARMIN_WORKOUT_SOURCE,
        externalId: workout.externalId,
        importId: importRecord.id,
      },
    });

    await prisma.workoutMetric.deleteMany({ where: { workoutId: saved.id } });
    if (workout.metrics.length > 0) {
      await prisma.workoutMetric.createMany({
        data: workout.metrics.map((metric) => ({
          workoutId: saved.id,
          key: metric.key,
          valueNum: metric.valueNum ?? null,
          valueText: metric.valueText ?? null,
          unit: metric.unit ?? null,
        })),
      });
    }
  }

  for (const health of parsed.dailyHealth) {
    const dayKey = isoDay(health.date);
    if (existingHealthDays.has(dayKey)) healthUpdated++;
    else {
      healthCreated++;
      existingHealthDays.add(dayKey);
    }

    await prisma.dailyHealth.upsert({
      where: {
        source_date: {
          source: GARMIN_WORKOUT_SOURCE,
          date: health.date,
        },
      },
      update: {
        ...health,
        importId: importRecord.id,
      },
      create: {
        ...health,
        source: GARMIN_WORKOUT_SOURCE,
        importId: importRecord.id,
      },
    });
  }

  return {
    ...parsed,
    importId: importRecord.id,
    workoutsCreated,
    workoutsUpdated,
    healthCreated,
    healthUpdated,
  };
}

function withReadonlyDb<T>(dbPath: string, fn: (db: Database) => T): T {
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

function readMeasurementSystem(db: Database): MeasurementSystem {
  if (!tableExists(db, "attributes")) return "statute";
  const columns = tableColumns(db, "attributes");
  if (!columns.has("key") || !columns.has("value")) return "statute";

  const row = db
    .prepare<{ value: unknown }>('SELECT "value" FROM "attributes" WHERE "key" = ?')
    .get("measurement_system");
  const measurement = asString(row?.value)?.toLowerCase();
  return measurement?.includes("metric") ? "metric" : "statute";
}

function readActivities(
  db: Database,
  measurementSystem: MeasurementSystem
): { workouts: ParsedGarminWorkout[]; skippedActivities: number } {
  const recordMetricsByActivity = readRecordMetricsByActivity(db, measurementSystem);
  const rows = selectRows<GarminActivityRow>(
    db,
    "activities",
    [
      "activity_id",
      "name",
      "description",
      "type",
      "sport",
      "sub_sport",
      "start_time",
      "stop_time",
      "elapsed_time",
      "moving_time",
      "distance",
      "avg_hr",
      "max_hr",
      "calories",
      "avg_cadence",
      "max_cadence",
      "avg_speed",
      "max_speed",
      "ascent",
      "descent",
      "training_load",
      "training_effect",
      "anaerobic_training_effect",
      "self_eval_feel",
      "self_eval_effort",
      "hrz_1_time",
      "hrz_2_time",
      "hrz_3_time",
      "hrz_4_time",
      "hrz_5_time",
    ],
    "start_time"
  );

  const workouts: ParsedGarminWorkout[] = [];
  let skippedActivities = 0;
  for (const row of rows) {
    const activityId = asString(row.activity_id);
    const startTime = parseDateTime(row.start_time);
    if (!activityId || !startTime) {
      skippedActivities++;
      continue;
    }

    const sport = asString(row.sport);
    const subSport = asString(row.sub_sport);
    const garminType = asString(row.type);
    const name = asString(row.name);
    const type = mapGarminSport(sport, subSport, garminType, name);
    const distance = normalizeWorkoutDistance(asNumber(row.distance), type, measurementSystem);
    const elapsedSeconds = parseTimeToSeconds(row.elapsed_time) ?? elapsedSecondsFromRange(startTime, row.stop_time);
    const metrics = [
      ...activityMetrics(row),
      ...(recordMetricsByActivity.get(activityId) ?? []),
    ];

    workouts.push({
      externalId: `garmin:${activityId}`,
      date: startTime,
      type,
      title: name ?? titleFromGarminSport(sport, subSport, garminType),
      durationMin: elapsedSeconds == null ? null : Math.round(elapsedSeconds / 60),
      distance: distance?.value ?? null,
      distanceUnit: distance?.unit ?? null,
      notes: asString(row.description),
      metrics,
    });
  }

  return { workouts, skippedActivities };
}

function readRecordMetricsByActivity(
  db: Database,
  measurementSystem: MeasurementSystem
): Map<string, GarminMetricDraft[]> {
  const out = new Map<string, GarminMetricDraft[]>();
  if (!tableExists(db, "activity_records")) return out;

  const rows = selectRows<GarminRecordRow>(
    db,
    "activity_records",
    ["activity_id", "timestamp", "distance", "hr", "speed"],
    "timestamp"
  );

  const byActivity = new Map<string, GarminRecordRow[]>();
  for (const row of rows) {
    const activityId = asString(row.activity_id);
    if (!activityId) continue;
    const group = byActivity.get(activityId) ?? [];
    group.push(row);
    byActivity.set(activityId, group);
  }

  for (const [activityId, records] of byActivity) {
    const metrics = timelineMetrics(records, measurementSystem);
    if (metrics.length > 0) out.set(activityId, metrics);
  }

  return out;
}

function readDailyHealth(
  db: Database,
  hrvByDay: Map<string, Pick<ParsedGarminDailyHealth, "hrvLastNightAvg" | "hrvWeeklyAvg" | "hrvStatus">>,
  measurementSystem: MeasurementSystem
): ParsedGarminDailyHealth[] {
  const rows = selectRows<GarminDailySummaryRow>(
    db,
    "days_summary",
    [
      "day",
      "hr_avg",
      "hr_min",
      "hr_max",
      "rhr_avg",
      "stress_avg",
      "steps",
      "intensity_time",
      "calories_active_avg",
      "calories_bmr_avg",
      "spo2_avg",
      "rr_waking_avg",
      "bb_min",
      "bb_max",
      "weight_avg",
    ],
    "day"
  );

  const out: ParsedGarminDailyHealth[] = [];
  for (const row of rows) {
    const date = parseDay(row.day);
    if (!date) continue;
    const hrv = hrvByDay.get(isoDay(date));
    out.push({
      date,
      steps: asInteger(row.steps),
      restingHr: asNumber(row.rhr_avg),
      avgHr: asNumber(row.hr_avg),
      minHr: asNumber(row.hr_min),
      maxHr: asNumber(row.hr_max),
      stressAvg: asNumber(row.stress_avg),
      intensityMin: secondsToMinutes(parseTimeToSeconds(row.intensity_time)),
      caloriesActive: asInteger(row.calories_active_avg),
      caloriesBmr: asInteger(row.calories_bmr_avg),
      bodyBatteryMin: asInteger(row.bb_min),
      bodyBatteryMax: asInteger(row.bb_max),
      spo2Avg: asNumber(row.spo2_avg),
      respirationAvg: asNumber(row.rr_waking_avg),
      hrvLastNightAvg: hrv?.hrvLastNightAvg ?? null,
      hrvWeeklyAvg: hrv?.hrvWeeklyAvg ?? null,
      hrvStatus: hrv?.hrvStatus ?? null,
      weight: asNumber(row.weight_avg),
      weightUnit: asNumber(row.weight_avg) == null ? null : measurementSystem === "metric" ? "kg" : "lb",
    });
  }
  return out;
}

function readHrvByDay(
  db: Database
): Map<string, Pick<ParsedGarminDailyHealth, "hrvLastNightAvg" | "hrvWeeklyAvg" | "hrvStatus">> {
  const out = new Map<
    string,
    Pick<ParsedGarminDailyHealth, "hrvLastNightAvg" | "hrvWeeklyAvg" | "hrvStatus">
  >();
  if (!tableExists(db, "hrv")) return out;

  const rows = selectRows<GarminHrvRow>(
    db,
    "hrv",
    ["day", "weekly_avg", "last_night_avg", "status"],
    "day"
  );
  for (const row of rows) {
    const date = parseDay(row.day);
    if (!date) continue;
    out.set(isoDay(date), {
      hrvLastNightAvg: asNumber(row.last_night_avg),
      hrvWeeklyAvg: asNumber(row.weekly_avg),
      hrvStatus: asString(row.status),
    });
  }
  return out;
}

function selectRows<T extends Record<string, unknown>>(
  db: Database,
  tableName: string,
  requestedColumns: string[],
  orderBy?: string
): T[] {
  if (!tableExists(db, tableName)) {
    throw new GarminDbImportError(`GarminDB table '${tableName}' was not found.`);
  }

  const columns = tableColumns(db, tableName);
  const select = requestedColumns
    .map((column) => (columns.has(column) ? `"${column}"` : `NULL AS "${column}"`))
    .join(", ");
  const order = orderBy && columns.has(orderBy) ? ` ORDER BY "${orderBy}"` : "";
  return db.prepare<T>(`SELECT ${select} FROM "${tableName}"${order}`).all();
}

function tableExists(db: Database, tableName: string): boolean {
  const row = db
    .prepare<{ name: string }>("SELECT name FROM sqlite_master WHERE type IN ('table', 'view') AND name = ?")
    .get(tableName);
  return row != null;
}

function tableColumns(db: Database, tableName: string): Set<string> {
  const rows = db.prepare<{ name: string }>(`PRAGMA table_info("${tableName}")`).all();
  return new Set(rows.map((row) => row.name));
}

function activityMetrics(row: GarminActivityRow): GarminMetricDraft[] {
  const metrics: GarminMetricDraft[] = [];
  addTextMetric(metrics, "garmin_sport", row.sport);
  addTextMetric(metrics, "garmin_sub_sport", row.sub_sport);
  addTextMetric(metrics, "garmin_type", row.type);
  addTextMetric(metrics, "garmin_self_eval_feel", row.self_eval_feel);
  addTextMetric(metrics, "garmin_self_eval_effort", row.self_eval_effort);
  addNumberMetric(metrics, "moving_time_s", parseTimeToSeconds(row.moving_time), "s");
  addNumberMetric(metrics, "avg_hr", row.avg_hr, "bpm");
  addNumberMetric(metrics, "max_hr", row.max_hr, "bpm");
  addNumberMetric(metrics, "calories", row.calories, "kcal");
  addNumberMetric(metrics, "avg_cadence", row.avg_cadence, "spm");
  addNumberMetric(metrics, "max_cadence", row.max_cadence, "spm");
  addNumberMetric(metrics, "avg_speed", row.avg_speed, null);
  addNumberMetric(metrics, "max_speed", row.max_speed, null);
  addNumberMetric(metrics, "ascent", row.ascent, null);
  addNumberMetric(metrics, "descent", row.descent, null);
  addNumberMetric(metrics, "training_load", row.training_load, null);
  addNumberMetric(metrics, "training_effect", row.training_effect, null);
  addNumberMetric(metrics, "anaerobic_training_effect", row.anaerobic_training_effect, null);
  for (let zone = 1; zone <= 5; zone++) {
    addNumberMetric(metrics, `hr_zone_${zone}_time_s`, parseTimeToSeconds(row[`hrz_${zone}_time`]), "s");
  }
  return metrics;
}

function timelineMetrics(records: GarminRecordRow[], measurementSystem: MeasurementSystem): GarminMetricDraft[] {
  const withTimestamps = records
    .map((record) => ({
      ts: parseDateTime(record.timestamp),
      hr: asNumber(record.hr),
      speed: asNumber(record.speed),
      distance: asNumber(record.distance),
    }))
    .filter((record): record is { ts: Date; hr: number | null; speed: number | null; distance: number | null } =>
      record.ts != null
    )
    .sort((a, b) => a.ts.getTime() - b.ts.getTime());

  if (withTimestamps.length < 4) return [];

  const firstTs = withTimestamps[0].ts.getTime();
  const lastTs = withTimestamps[withTimestamps.length - 1].ts.getTime();
  const durationMs = lastTs - firstTs;
  if (durationMs <= 0) return [];

  const segmentCount = Math.min(8, Math.max(4, Math.floor(withTimestamps.length / 3)));
  const groups = Array.from({ length: segmentCount }, () => [] as typeof withTimestamps);
  for (const record of withTimestamps) {
    const pct = (record.ts.getTime() - firstTs) / durationMs;
    const index = Math.min(segmentCount - 1, Math.floor(pct * segmentCount));
    groups[index].push(record);
  }

  const speedUnit = measurementSystem === "metric" ? "km/h" : "mph";
  const distanceUnit = measurementSystem === "metric" ? "km" : "mi";
  const segments = groups
    .map((group, index) => {
      if (group.length === 0) return null;
      return {
        fromPct: Math.round((index / segmentCount) * 100),
        toPct: Math.round(((index + 1) / segmentCount) * 100),
        durationSec: Math.round(durationMs / segmentCount / 1000),
        distance: roundNullable(cumulativeDistance(group.map((record) => record.distance))),
        avgSpeed: roundNullable(average(group.map((record) => record.speed))),
        avgHr: roundNullable(average(group.map((record) => record.hr))),
      };
    })
    .filter((segment): segment is NonNullable<typeof segment> => segment != null);

  if (segments.length === 0) return [];

  return [
    {
      key: "record_timeline",
      valueText: JSON.stringify({
        units: { speed: speedUnit, distance: distanceUnit, hr: "bpm" },
        segments,
      }),
    },
  ];
}

function average(values: Array<number | null>): number | null {
  const numeric = values.filter((value): value is number => value != null && Number.isFinite(value));
  if (numeric.length === 0) return null;
  return numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
}

function cumulativeDistance(values: Array<number | null>): number | null {
  const numeric = values.filter((value): value is number => value != null && Number.isFinite(value));
  if (numeric.length < 2) return null;
  const delta = Math.max(...numeric) - Math.min(...numeric);
  return delta >= 0 ? delta : null;
}

function roundNullable(value: number | null): number | null {
  return value == null ? null : Math.round(value * 10) / 10;
}

function normalizeWorkoutDistance(
  distance: number | null,
  type: string,
  measurementSystem: MeasurementSystem
): { value: number; unit: string } | null {
  if (distance == null) return null;
  if (type === "swim") {
    return measurementSystem === "metric"
      ? { value: roundDistance(distance * 1000), unit: "m" }
      : { value: Math.round(distance * 1760), unit: "yd" };
  }
  return {
    value: roundDistance(distance),
    unit: measurementSystem === "metric" ? "km" : "mi",
  };
}

function roundDistance(distance: number): number {
  return Math.round(distance * 100) / 100;
}

function addTextMetric(metrics: GarminMetricDraft[], key: string, value: unknown): void {
  const valueText = asString(value);
  if (valueText != null) metrics.push({ key, valueText });
}

function addNumberMetric(
  metrics: GarminMetricDraft[],
  key: string,
  value: unknown,
  unit: string | null
): void {
  const valueNum = asNumber(value);
  if (valueNum != null) metrics.push({ key, valueNum, unit });
}

export function mapGarminSport(
  sport: string | null,
  subSport: string | null,
  garminType: string | null,
  name: string | null
): string {
  const haystack = [sport, subSport, garminType, name].filter(Boolean).join(" ").toLowerCase();
  if (/\b(run|running|trail_running|treadmill)\b/.test(haystack)) return "run";
  if (/\b(cycling|biking|bike|bicycling|indoor_cycling)\b/.test(haystack)) return "bike";
  if (/\b(swim|swimming|lap_swimming|open_water)\b/.test(haystack)) return "swim";
  if (/\b(strength|cardio_training|training|weights|weight_training)\b/.test(haystack)) return "lift";
  if (/\b(multisport|triathlon|brick)\b/.test(haystack)) return "brick";
  return "other";
}

function titleFromGarminSport(
  sport: string | null,
  subSport: string | null,
  garminType: string | null
): string {
  return sport ?? subSport ?? garminType ?? "Garmin activity";
}

function parseDateTime(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const raw = asString(value);
  if (!raw) return null;

  const match = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?/
  );
  if (!match) return null;
  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4] ?? 0),
    Number(match[5] ?? 0),
    Number(match[6] ?? 0)
  );
}

function parseDay(value: unknown): Date | null {
  const date = parseDateTime(value);
  if (!date) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseTimeToSeconds(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = asString(value);
  if (!raw) return null;
  const match = raw.match(/^(\d{1,3}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/);
  if (!match) return null;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3] ?? 0);
}

function elapsedSecondsFromRange(startTime: Date, stopTime: unknown): number | null {
  const stop = parseDateTime(stopTime);
  if (!stop) return null;
  const seconds = Math.round((stop.getTime() - startTime.getTime()) / 1000);
  return seconds >= 0 ? seconds : null;
}

function secondsToMinutes(seconds: number | null): number | null {
  return seconds == null ? null : Math.round(seconds / 60);
}

function asString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  return null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asInteger(value: unknown): number | null {
  const number = asNumber(value);
  return number == null ? null : Math.round(number);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown Garmin sync error.";
}
