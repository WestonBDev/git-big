import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { mkdir, writeFile, stat } from "node:fs/promises";
import { dirname, resolve, join } from "node:path";

interface ParsedWorkout {
  activityType: string;
  durationSeconds: number;
  startDate: string;
}

function extractAttr(line: string, name: string): string | undefined {
  const regex = new RegExp(`${name}="([^"]*)"`);
  const match = line.match(regex);
  return match?.[1];
}

function toIsoTimestamp(ahDate: string): string {
  // "2022-07-20 18:57:42 -0700" -> "2022-07-20T18:57:42-07:00"
  const parts = ahDate.match(
    /^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\s+([+-]\d{2})(\d{2})$/
  );
  if (!parts) return ahDate;
  return `${parts[1]}T${parts[2]}${parts[3]}:${parts[4]}`;
}

function toSafeFilename(ahDate: string): string {
  return ahDate.replace(/[^0-9-]/g, "_").replace(/_+/g, "_");
}

function mapSport(activityType: string): string {
  if (activityType.includes("Running")) return "Running";
  if (activityType.includes("Cycling") || activityType.includes("Biking")) return "Biking";
  return "Other";
}

function buildTcx(workout: ParsedWorkout): string {
  const sport = mapSport(workout.activityType);
  const iso = toIsoTimestamp(workout.startDate);

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">`,
    `  <Activities>`,
    `    <Activity Sport="${sport}">`,
    `      <Id>${iso}</Id>`,
    `      <Lap StartTime="${iso}">`,
    `        <TotalTimeSeconds>${workout.durationSeconds.toFixed(1)}</TotalTimeSeconds>`,
    `        <DistanceMeters>0</DistanceMeters>`,
    `        <Calories>0</Calories>`,
    `        <Intensity>Active</Intensity>`,
    `        <TriggerMethod>Manual</TriggerMethod>`,
    `      </Lap>`,
    `    </Activity>`,
    `  </Activities>`,
    `</TrainingCenterDatabase>`,
    ``
  ].join("\n");
}

function parseDurationSeconds(raw: string | undefined, unit: string): number {
  if (!raw) return 0;
  const value = parseFloat(raw);
  if (!Number.isFinite(value) || value <= 0) return 0;

  switch (unit) {
    case "s":
      return value;
    case "hr":
      return value * 3600;
    default:
      return value * 60;
  }
}

async function main(): Promise<void> {
  const xmlPath = process.argv[2];
  if (!xmlPath) {
    process.stderr.write(
      "Usage: npx tsx scripts/apple-health-to-tcx.ts <path-to-export.xml>\n\n" +
        "Converts Apple Health workouts (without GPS routes) to TCX files\n" +
        "that can be uploaded to Strava.\n\n" +
        "Example:\n" +
        "  npx tsx scripts/apple-health-to-tcx.ts ~/Downloads/apple_health_export/export.xml\n"
    );
    process.exitCode = 1;
    return;
  }

  const resolved = resolve(xmlPath);
  const info = await stat(resolved).catch(() => null);
  if (!info?.isFile()) {
    process.stderr.write(`File not found: ${resolved}\n`);
    process.exitCode = 1;
    return;
  }

  const outDir = join(dirname(resolved), "strava-upload-tcx");
  await mkdir(outDir, { recursive: true });

  process.stdout.write(`Parsing ${resolved} ...\n`);

  const stream = createReadStream(resolved, { encoding: "utf8" });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  let currentTag: string | null = null;
  let hasRoute = false;
  let total = 0;
  let skipped = 0;
  let written = 0;

  for await (const line of rl) {
    const trimmed = line.trimStart();

    if (trimmed.startsWith("<Workout ")) {
      currentTag = trimmed;
      hasRoute = false;
      total++;
    } else if (trimmed.startsWith("<WorkoutRoute ") && currentTag) {
      hasRoute = true;
    } else if (trimmed.startsWith("</Workout>") && currentTag) {
      if (hasRoute) {
        skipped++;
      } else {
        const activityType = extractAttr(currentTag, "workoutActivityType") ?? "Other";
        const durationRaw = extractAttr(currentTag, "duration");
        const durationUnit = extractAttr(currentTag, "durationUnit") ?? "min";
        const startDate = extractAttr(currentTag, "startDate");

        const durationSeconds = parseDurationSeconds(durationRaw, durationUnit);

        if (startDate && durationSeconds > 0) {
          const workout: ParsedWorkout = { activityType, durationSeconds, startDate };
          const filename = `workout_${toSafeFilename(startDate)}.tcx`;
          await writeFile(join(outDir, filename), buildTcx(workout), "utf8");
          written++;
        }
      }

      currentTag = null;
      hasRoute = false;
    }
  }

  process.stdout.write(`\nDone.\n`);
  process.stdout.write(`  Total workouts:                ${total}\n`);
  process.stdout.write(`  Skipped (have GPS routes):     ${skipped}\n`);
  process.stdout.write(`  TCX files written:             ${written}\n`);
  process.stdout.write(`  Output directory:              ${outDir}\n`);
  process.stdout.write(
    `\nNext steps:\n` +
      `  1. Upload TCX files to https://www.strava.com/upload/select (25 at a time)\n` +
      `  2. Upload GPX files from workout-routes/ for GPS-tracked activities\n` +
      `  3. Re-run 'npm run generate' to rebuild the FitHub graph\n`
  );
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`${msg}\n`);
  process.exitCode = 1;
});
