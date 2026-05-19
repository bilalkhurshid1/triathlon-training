import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { importDiaryTxt } from "../src/lib/importers/diary-txt";

async function main() {
  const arg = process.argv[2] ?? "./training-diary.txt";
  const filepath = resolve(process.cwd(), arg);
  const raw = readFileSync(filepath, "utf8");
  const result = await importDiaryTxt(raw);
  console.log(
    JSON.stringify(
      {
        importId: result.importId,
        daysParsed: result.daysParsed,
        workoutsCreated: result.workoutsCreated,
        workoutsUpdated: result.workoutsUpdated,
        unrecognizedCount: result.unrecognized.length,
        unrecognized: result.unrecognized,
      },
      null,
      2
    )
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
