import type { Profile, Race } from "@/generated/prisma/client";
import { isoDay, daysUntil } from "@/lib/dates";
import {
  loadFlags,
  milestones,
  recentWorkouts,
  weeklyTotals,
  type LoadFlags,
  type Milestone,
  type RecentWorkout,
  type WeeklyTotal,
} from "@/lib/coach/summaries";

export type CoachContext = {
  today: string;
  race: {
    name: string;
    date: string;
    daysUntil: number;
    swimYards: number | null;
    bikeMiles: number | null;
    runMiles: number | null;
    goals: string | null;
  } | null;
  profile: {
    goals: string | null;
    weaknesses: string | null;
    injuries: string | null;
    constraints: string | null;
    assumptions: string | null;
    coachingPrefs: string | null;
  };
  weeklyTotals: WeeklyTotal[];
  recentWorkouts: RecentWorkout[];
  loadFlags: LoadFlags;
  milestones: Milestone[];
  userQuestion: string;
};

type BuildArgs = {
  now?: Date;
  race: Race | null;
  profile: Profile | null;
  userMsg: string;
};

export async function buildCoachContext(args: BuildArgs): Promise<CoachContext> {
  const now = args.now ?? new Date();
  const [weeks, recent, flags, ms] = await Promise.all([
    weeklyTotals(4, now),
    recentWorkouts(14, now),
    loadFlags(now),
    milestones(),
  ]);

  return {
    today: isoDay(now),
    race: args.race
      ? {
          name: args.race.name,
          date: isoDay(new Date(args.race.date)),
          daysUntil: daysUntil(new Date(args.race.date), now),
          swimYards: args.race.swimYards,
          bikeMiles: args.race.bikeMiles,
          runMiles: args.race.runMiles,
          goals: args.race.goals,
        }
      : null,
    profile: {
      goals: args.profile?.goals ?? null,
      weaknesses: args.profile?.weaknesses ?? null,
      injuries: args.profile?.injuries ?? null,
      constraints: args.profile?.trainingConstraints ?? null,
      assumptions: args.profile?.assumptions ?? null,
      coachingPrefs: args.profile?.coachingPrefs ?? null,
    },
    weeklyTotals: weeks,
    recentWorkouts: recent,
    loadFlags: flags,
    milestones: ms,
    userQuestion: args.userMsg,
  };
}
