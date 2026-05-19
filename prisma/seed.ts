import { prisma } from "../src/lib/db";

async function main() {
  await prisma.profile.upsert({
    where: { id: "me" },
    update: {},
    create: {
      id: "me",
      displayName: "Bilal",
      goals: "Lose belly fat, build some muscle, complete the sprint triathlon on 2026-08-23.",
      weaknesses: "Swimming — confidence and breathing economy are the limiters.",
      injuries: "Left shoulder soreness after one-sided breathing in the pool.",
      trainingConstraints: "Access to a YMCA pool, a home/work gym, and outdoor cycling.",
      assumptions:
        "Currently swim ~1 length before needing rest. New to cycling. Comfortable lifting upper/push/pull/leg splits.",
      coachingPrefs: "Practical, specific workouts. Lead with the recommendation, then the reasoning.",
      nutritionPrefs: "Open to suggestions. Prefer protein-forward meals; not vegetarian.",
    },
  });

  await prisma.settings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      provider: "anthropic",
      model: "claude-opus-4-7",
    },
  });

  const existingPrimary = await prisma.race.findFirst({ where: { isPrimary: true } });
  if (!existingPrimary) {
    await prisma.race.create({
      data: {
        name: "Sprint Triathlon",
        date: new Date("2026-08-23T00:00:00"),
        swimYards: 803,
        bikeMiles: 15.4,
        runMiles: 3.1,
        isPrimary: true,
        goals: "Finish comfortably. Don't walk the run. Don't panic in the swim.",
      },
    });
  }

  console.log("Seed complete.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
