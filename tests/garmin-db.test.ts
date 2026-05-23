import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import Database from "better-sqlite3";

const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), "training-garmin-db-"));
const appDbPath = path.join(testRoot, "app.db");
process.env.DATABASE_URL = `file:${appDbPath}`;

createAppSchema(appDbPath);

const importer = import("../src/lib/importers/garmin-db");
const db = import("../src/lib/db");

test.after(async () => {
  const { prisma } = await db;
  await prisma.$disconnect();
  fs.rmSync(testRoot, { recursive: true, force: true });
});

test("reports missing GarminDB files", async () => {
  const { GarminDbImportError, readGarminDbExport } = await importer;
  const sourceDir = path.join(testRoot, "missing-source");
  fs.mkdirSync(sourceDir);

  assert.throws(() => readGarminDbExport(sourceDir), GarminDbImportError);
});

test("imports GarminDB workouts and health idempotently", async () => {
  const { importGarminDb } = await importer;
  const { prisma } = await db;
  await clearAppData(prisma);

  const sourceDir = path.join(testRoot, "garmin-source");
  createGarminFixture(sourceDir);

  await prisma.workout.create({
    data: {
      date: new Date(2026, 4, 18),
      type: "run",
      title: "Manual run",
      source: "manual",
    },
  });

  const first = await importGarminDb(sourceDir);
  assert.equal(first.workoutsCreated, 2);
  assert.equal(first.workoutsUpdated, 0);
  assert.equal(first.healthCreated, 1);
  assert.equal(first.healthUpdated, 0);

  const second = await importGarminDb(sourceDir);
  assert.equal(second.workoutsCreated, 0);
  assert.equal(second.workoutsUpdated, 2);
  assert.equal(second.healthCreated, 0);
  assert.equal(second.healthUpdated, 1);

  const workouts = await prisma.workout.findMany({
    include: { metrics: true },
    orderBy: [{ source: "asc" }, { date: "asc" }],
  });
  assert.equal(workouts.length, 3);
  assert.equal(workouts.filter((workout) => workout.source === "manual").length, 1);

  const runWorkout = workouts.find((workout) => workout.externalId === "garmin:12345");
  assert.ok(runWorkout);
  assert.equal(runWorkout.type, "run");
  assert.equal(runWorkout.durationMin, 43);
  assert.equal(runWorkout.distance, 4.2);
  assert.equal(runWorkout.distanceUnit, "mi");
  assert.equal(runWorkout.metrics.filter((metric) => metric.key === "avg_hr").length, 1);
  assert.equal(runWorkout.metrics.some((metric) => metric.key === "hr_zone_2_time_s"), true);
  const timeline = runWorkout.metrics.find((metric) => metric.key === "record_timeline");
  assert.ok(timeline?.valueText);
  const parsedTimeline = JSON.parse(timeline.valueText) as {
    units: { speed: string; distance: string };
    segments: Array<{ fromPct: number; toPct: number; avgSpeed: number | null; avgHr: number | null }>;
  };
  assert.equal(parsedTimeline.units.speed, "mph");
  assert.ok(parsedTimeline.segments.length >= 3);
  assert.equal(parsedTimeline.segments[0].fromPct, 0);
  assert.equal(parsedTimeline.segments.at(-1)?.toPct, 100);
  assert.ok((parsedTimeline.segments[0].avgSpeed ?? 0) > (parsedTimeline.segments.at(-1)?.avgSpeed ?? 0));
  assert.ok((parsedTimeline.segments.at(-1)?.avgHr ?? 0) > (parsedTimeline.segments[0].avgHr ?? 0));

  const swimWorkout = workouts.find((workout) => workout.externalId === "garmin:67890");
  assert.ok(swimWorkout);
  assert.equal(swimWorkout.type, "swim");
  assert.equal(swimWorkout.distance, 480);
  assert.equal(swimWorkout.distanceUnit, "yd");

  const healthRows = await prisma.dailyHealth.findMany();
  assert.equal(healthRows.length, 1);
  assert.equal(healthRows[0].source, "garmin");
  assert.equal(healthRows[0].steps, 8421);
  assert.equal(healthRows[0].hrvLastNightAvg, 44);
  assert.equal(healthRows[0].hrvStatus, "balanced");
});

async function clearAppData(prisma: Awaited<typeof db>["prisma"]) {
  await prisma.workoutMetric.deleteMany();
  await prisma.workout.deleteMany();
  await prisma.dailyHealth.deleteMany();
  await prisma.activityImport.deleteMany();
  await prisma.integrationConfig.deleteMany();
}

function createAppSchema(filename: string) {
  const appDb = new Database(filename);
  try {
    appDb.exec(`
      CREATE TABLE "Workout" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "date" DATETIME NOT NULL,
        "type" TEXT NOT NULL,
        "title" TEXT,
        "durationMin" INTEGER,
        "distance" REAL,
        "distanceUnit" TEXT,
        "rpe" INTEGER,
        "soreness" INTEGER,
        "notes" TEXT,
        "source" TEXT NOT NULL DEFAULT 'manual',
        "externalId" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL,
        "importId" TEXT
      );
      CREATE UNIQUE INDEX "Workout_source_externalId_key" ON "Workout"("source", "externalId");

      CREATE TABLE "WorkoutMetric" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "workoutId" TEXT NOT NULL,
        "key" TEXT NOT NULL,
        "valueNum" REAL,
        "valueText" TEXT,
        "unit" TEXT
      );
      CREATE INDEX "WorkoutMetric_workoutId_key_idx" ON "WorkoutMetric"("workoutId", "key");

      CREATE TABLE "DailyHealth" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "date" DATETIME NOT NULL,
        "source" TEXT NOT NULL DEFAULT 'manual',
        "steps" INTEGER,
        "restingHr" REAL,
        "avgHr" REAL,
        "minHr" REAL,
        "maxHr" REAL,
        "stressAvg" REAL,
        "intensityMin" INTEGER,
        "caloriesActive" INTEGER,
        "caloriesBmr" INTEGER,
        "bodyBatteryMin" INTEGER,
        "bodyBatteryMax" INTEGER,
        "spo2Avg" REAL,
        "respirationAvg" REAL,
        "hrvLastNightAvg" REAL,
        "hrvWeeklyAvg" REAL,
        "hrvStatus" TEXT,
        "weight" REAL,
        "weightUnit" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL,
        "importId" TEXT
      );
      CREATE UNIQUE INDEX "DailyHealth_source_date_key" ON "DailyHealth"("source", "date");

      CREATE TABLE "IntegrationConfig" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "provider" TEXT NOT NULL,
        "sourcePath" TEXT,
        "lastSyncAt" DATETIME,
        "lastSyncStatus" TEXT,
        "lastSyncMessage" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL
      );
      CREATE UNIQUE INDEX "IntegrationConfig_provider_key" ON "IntegrationConfig"("provider");

      CREATE TABLE "ActivityImport" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "source" TEXT NOT NULL,
        "rawText" TEXT,
        "rawJson" TEXT,
        "rawFilePath" TEXT,
        "parsedAt" DATETIME,
        "parseError" TEXT,
        "accountId" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } finally {
    appDb.close();
  }
}

function createGarminFixture(sourceDir: string) {
  fs.mkdirSync(sourceDir, { recursive: true });

  const garminDb = new Database(path.join(sourceDir, "garmin.db"));
  try {
    garminDb.exec(`
      CREATE TABLE "attributes" ("key" TEXT NOT NULL PRIMARY KEY, "value" TEXT);
      INSERT INTO "attributes" ("key", "value") VALUES ('measurement_system', 'statute');

      CREATE TABLE "hrv" (
        "day" DATETIME NOT NULL PRIMARY KEY,
        "weekly_avg" INTEGER,
        "last_night_avg" INTEGER,
        "status" TEXT
      );
      INSERT INTO "hrv" ("day", "weekly_avg", "last_night_avg", "status")
      VALUES ('2026-05-20 00:00:00', 48, 44, 'balanced');
    `);
  } finally {
    garminDb.close();
  }

  const activitiesDb = new Database(path.join(sourceDir, "garmin_activities.db"));
  try {
    activitiesDb.exec(`
      CREATE TABLE "activities" (
        "activity_id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT,
        "description" TEXT,
        "type" TEXT,
        "sport" TEXT,
        "sub_sport" TEXT,
        "start_time" DATETIME,
        "stop_time" DATETIME,
        "elapsed_time" TIME,
        "moving_time" TIME,
        "distance" REAL,
        "avg_hr" INTEGER,
        "max_hr" INTEGER,
        "calories" INTEGER,
        "avg_cadence" INTEGER,
        "max_cadence" INTEGER,
        "avg_speed" REAL,
        "max_speed" REAL,
        "ascent" REAL,
        "descent" REAL,
        "training_load" REAL,
        "training_effect" REAL,
        "anaerobic_training_effect" REAL,
        "self_eval_feel" TEXT,
        "self_eval_effort" TEXT,
        "hrz_1_time" TIME,
        "hrz_2_time" TIME,
        "hrz_3_time" TIME,
        "hrz_4_time" TIME,
        "hrz_5_time" TIME
      );
      INSERT INTO "activities" (
        "activity_id", "name", "description", "type", "sport", "sub_sport",
        "start_time", "stop_time", "elapsed_time", "moving_time", "distance",
        "avg_hr", "max_hr", "calories", "avg_cadence", "max_cadence",
        "avg_speed", "max_speed", "ascent", "descent", "training_load",
        "training_effect", "anaerobic_training_effect", "self_eval_feel",
        "self_eval_effort", "hrz_1_time", "hrz_2_time", "hrz_3_time",
        "hrz_4_time", "hrz_5_time"
      )
      VALUES (
        '12345', 'Morning Run', 'easy aerobic', 'fitness', 'running', 'street',
        '2026-05-20 06:15:00', '2026-05-20 06:57:30', '00:42:30', '00:41:00', 4.2,
        145, 168, 420, 172, 186, 5.9, 8.1, 90, 84, 55,
        3.1, 0.8, 'good', 'moderate', '00:05:00', '00:12:00',
        '00:15:00', '00:08:00', '00:02:30'
      );
      INSERT INTO "activities" (
        "activity_id", "name", "description", "type", "sport", "sub_sport",
        "start_time", "stop_time", "elapsed_time", "moving_time", "distance",
        "avg_hr", "max_hr", "calories", "avg_cadence", "max_cadence",
        "avg_speed", "max_speed", "ascent", "descent", "training_load",
        "training_effect", "anaerobic_training_effect", "self_eval_feel",
        "self_eval_effort", "hrz_1_time", "hrz_2_time", "hrz_3_time",
        "hrz_4_time", "hrz_5_time"
      )
      VALUES (
        '67890', 'Pool Swim', 'form work', 'fitness', 'swimming', 'lap_swimming',
        '2026-05-20 18:00:00', '2026-05-20 18:30:00', '00:30:00', '00:28:00', 0.2727272727,
        118, 140, 180, NULL, NULL, 0.55, 0.8, NULL, NULL, 12,
        1.6, 0, 'good', 'easy', '00:08:00', '00:12:00',
        '00:06:00', '00:03:00', '00:01:00'
      );

      CREATE TABLE "activity_records" (
        "activity_id" TEXT,
        "record" INTEGER,
        "timestamp" DATETIME,
        "distance" REAL,
        "hr" INTEGER,
        "speed" REAL
      );
      INSERT INTO "activity_records" ("activity_id", "record", "timestamp", "distance", "hr", "speed")
      VALUES
        ('12345', 1, '2026-05-20 06:15:00', 0.0, 138, 7.4),
        ('12345', 2, '2026-05-20 06:25:00', 1.3, 144, 7.1),
        ('12345', 3, '2026-05-20 06:45:00', 3.0, 156, 5.0),
        ('12345', 4, '2026-05-20 06:57:30', 4.2, 162, 4.9);
    `);
  } finally {
    activitiesDb.close();
  }

  const summaryDb = new Database(path.join(sourceDir, "garmin_summary.db"));
  try {
    summaryDb.exec(`
      CREATE TABLE "days_summary" (
        "day" DATETIME NOT NULL PRIMARY KEY,
        "hr_avg" REAL,
        "hr_min" REAL,
        "hr_max" REAL,
        "rhr_avg" REAL,
        "stress_avg" REAL,
        "steps" INTEGER,
        "intensity_time" TIME,
        "calories_active_avg" INTEGER,
        "calories_bmr_avg" INTEGER,
        "spo2_avg" REAL,
        "rr_waking_avg" REAL,
        "bb_min" INTEGER,
        "bb_max" INTEGER,
        "weight_avg" REAL
      );
      INSERT INTO "days_summary" (
        "day", "hr_avg", "hr_min", "hr_max", "rhr_avg", "stress_avg",
        "steps", "intensity_time",
        "calories_active_avg", "calories_bmr_avg", "spo2_avg",
        "rr_waking_avg", "bb_min", "bb_max", "weight_avg"
      )
      VALUES (
        '2026-05-20 00:00:00', 72, 44, 168, 49, 31,
        8421, '00:42:00',
        650, 1800, 97, 14.4, 32, 88, 182.4
      );
    `);
  } finally {
    summaryDb.close();
  }
}
