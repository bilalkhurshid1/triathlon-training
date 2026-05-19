-- CreateTable
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
    "importId" TEXT,
    CONSTRAINT "Workout_importId_fkey" FOREIGN KEY ("importId") REFERENCES "ActivityImport" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkoutMetric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workoutId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "valueNum" REAL,
    "valueText" TEXT,
    "unit" TEXT,
    CONSTRAINT "WorkoutMetric_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "Workout" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Race" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "swimYards" INTEGER,
    "bikeMiles" REAL,
    "runMiles" REAL,
    "goals" TEXT,
    "notes" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'me',
    "displayName" TEXT,
    "goals" TEXT,
    "nutritionPrefs" TEXT,
    "trainingConstraints" TEXT,
    "injuries" TEXT,
    "assumptions" TEXT,
    "coachingPrefs" TEXT,
    "weaknesses" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "provider" TEXT,
    "model" TEXT,
    "contextJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "provider" TEXT NOT NULL DEFAULT 'anthropic',
    "model" TEXT NOT NULL DEFAULT 'claude-opus-4-7',
    "systemPromptOverride" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ExternalAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "accountLabel" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ActivityImport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "rawText" TEXT,
    "rawJson" TEXT,
    "rawFilePath" TEXT,
    "parsedAt" DATETIME,
    "parseError" TEXT,
    "accountId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityImport_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ExternalAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Workout_date_idx" ON "Workout"("date");

-- CreateIndex
CREATE INDEX "Workout_type_date_idx" ON "Workout"("type", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Workout_source_externalId_key" ON "Workout"("source", "externalId");

-- CreateIndex
CREATE INDEX "WorkoutMetric_workoutId_key_idx" ON "WorkoutMetric"("workoutId", "key");

-- CreateIndex
CREATE INDEX "ChatMessage_createdAt_idx" ON "ChatMessage"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalAccount_provider_accountLabel_key" ON "ExternalAccount"("provider", "accountLabel");
