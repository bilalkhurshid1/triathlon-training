-- CreateTable
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
    "sleepMin" INTEGER,
    "remSleepMin" INTEGER,
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
    "importId" TEXT,
    CONSTRAINT "DailyHealth_importId_fkey" FOREIGN KEY ("importId") REFERENCES "ActivityImport" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
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

-- CreateIndex
CREATE UNIQUE INDEX "DailyHealth_source_date_key" ON "DailyHealth"("source", "date");

-- CreateIndex
CREATE INDEX "DailyHealth_date_idx" ON "DailyHealth"("date");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationConfig_provider_key" ON "IntegrationConfig"("provider");
