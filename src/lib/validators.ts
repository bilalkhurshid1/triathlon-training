import { z } from "zod";

export const WORKOUT_TYPES = ["swim", "bike", "run", "lift", "rest", "brick", "other"] as const;
export type WorkoutType = (typeof WORKOUT_TYPES)[number];

export const DISTANCE_UNITS = ["yd", "mi", "km", "m"] as const;
export type DistanceUnit = (typeof DISTANCE_UNITS)[number];

const optionalString = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : v),
  z.string().trim().min(1).nullable()
);

const optionalInt = (min: number, max: number) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : v),
    z.coerce.number().int().min(min).max(max).nullable()
  );

const optionalFloat = (min: number, max: number) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : v),
    z.coerce.number().min(min).max(max).nullable()
  );

export const workoutFormSchema = z.object({
  id: z.string().optional(),
  date: z.string().min(1, "date required"),
  type: z.enum(WORKOUT_TYPES),
  title: optionalString,
  durationMin: optionalInt(0, 24 * 60),
  distance: optionalFloat(0, 1000),
  distanceUnit: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : v),
    z.enum(DISTANCE_UNITS).nullable()
  ),
  rpe: optionalInt(1, 10),
  soreness: optionalInt(1, 10),
  notes: optionalString,
});

export type WorkoutFormInput = z.infer<typeof workoutFormSchema>;

export const profileFormSchema = z.object({
  displayName: optionalString,
  goals: optionalString,
  weaknesses: optionalString,
  injuries: optionalString,
  trainingConstraints: optionalString,
  assumptions: optionalString,
  coachingPrefs: optionalString,
  nutritionPrefs: optionalString,
});

export const raceFormSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  date: z.string().min(1),
  swimYards: optionalInt(0, 100_000),
  bikeMiles: optionalFloat(0, 10_000),
  runMiles: optionalFloat(0, 10_000),
  goals: optionalString,
  notes: optionalString,
});

export const PROVIDERS = ["anthropic", "openai"] as const;
export type Provider = (typeof PROVIDERS)[number];

export const settingsFormSchema = z.object({
  provider: z.enum(PROVIDERS),
  model: z.string().min(1),
  systemPromptOverride: optionalString,
});
