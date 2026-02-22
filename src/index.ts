import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { addDaysUtc, startOfUtcDay, startOfWeekSunday } from "./date.js";
import { fetchLastYearActivitiesWithRefreshToken, type StravaCredentials } from "./fetch.js";
import {
  DEFAULT_THRESHOLDS,
  aggregateMinutesByDate,
  fillDateRange,
  normalizeMinutesByDate,
  type Thresholds
} from "./normalize.js";
import { renderContributionGraph } from "./render.js";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function parseEndDate(configuredEndDate: string | undefined): Date {
  if (!configuredEndDate) {
    return startOfUtcDay(new Date());
  }

  const parsed = new Date(`${configuredEndDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid FITHUB_END_DATE value: ${configuredEndDate}`);
  }

  return startOfUtcDay(parsed);
}

export function parseThresholds(configured: string | undefined): Thresholds {
  if (!configured) {
    return DEFAULT_THRESHOLDS;
  }

  const values = configured
    .split(",")
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter((value) => Number.isFinite(value));

  if (values.length !== 4) {
    throw new Error(
      `Invalid FITHUB_THRESHOLDS value: ${configured}. Expected 4 comma-separated integers.`
    );
  }

  const parsedThresholds: Thresholds = [values[0]!, values[1]!, values[2]!, values[3]!];
  const [level1, level2, level3, level4] = parsedThresholds;
  if (!(level1 < level2 && level2 < level3 && level3 < level4)) {
    throw new Error(
      `Invalid FITHUB_THRESHOLDS value: ${configured}. Thresholds must be strictly ascending.`
    );
  }

  return parsedThresholds;
}

async function generateGraph(
  credentials: StravaCredentials,
  outputPaths: {
    legacySvgPath: string;
    darkSvgPath: string;
    lightSvgPath: string;
    levelsPath: string;
  }
): Promise<void> {
  const endDate = parseEndDate(process.env.FITHUB_END_DATE);
  const thresholds = parseThresholds(process.env.FITHUB_THRESHOLDS);
  const refreshTokenOutputPath = process.env.FITHUB_REFRESH_TOKEN_OUTPUT;

  const { activities, refreshToken } = await fetchLastYearActivitiesWithRefreshToken(credentials, endDate);
  const minutesByDate = aggregateMinutesByDate(activities);
  const levelsByDate = normalizeMinutesByDate(minutesByDate, thresholds);

  const yearStart = addDaysUtc(endDate, -364);
  const renderStart = startOfWeekSunday(addDaysUtc(endDate, -364));
  const lastYearLevelsByDate = fillDateRange(levelsByDate, yearStart, endDate);
  const filledMinutesByDate = fillDateRange(minutesByDate, renderStart, endDate);
  const filledLevelsByDate = fillDateRange(levelsByDate, renderStart, endDate);

  const darkSvg = renderContributionGraph({
    levelsByDate: filledLevelsByDate,
    minutesByDate: filledMinutesByDate,
    endDate,
    theme: "dark"
  });

  const lightSvg = renderContributionGraph({
    levelsByDate: filledLevelsByDate,
    minutesByDate: filledMinutesByDate,
    endDate,
    theme: "light"
  });

  await mkdir(dirname(outputPaths.legacySvgPath), { recursive: true });
  await Promise.all([
    writeFile(outputPaths.legacySvgPath, darkSvg, "utf8"),
    writeFile(outputPaths.darkSvgPath, darkSvg, "utf8"),
    writeFile(outputPaths.lightSvgPath, lightSvg, "utf8"),
    writeFile(outputPaths.levelsPath, `${JSON.stringify(lastYearLevelsByDate, null, 2)}\n`, "utf8")
  ]);

  if (refreshTokenOutputPath) {
    await mkdir(dirname(refreshTokenOutputPath), { recursive: true });
    await writeFile(refreshTokenOutputPath, `${refreshToken}\n`, "utf8");
  }
}

async function main(): Promise<void> {
  const credentials: StravaCredentials = {
    clientId: requiredEnv("STRAVA_CLIENT_ID"),
    clientSecret: requiredEnv("STRAVA_CLIENT_SECRET"),
    refreshToken: requiredEnv("STRAVA_REFRESH_TOKEN")
  };

  const svgPath = resolve(process.cwd(), "dist", "fithub.svg");
  const darkSvgPath = resolve(process.cwd(), "dist", "fithub-dark.svg");
  const lightSvgPath = resolve(process.cwd(), "dist", "fithub-light.svg");
  const levelsPath = resolve(process.cwd(), "dist", "fithub-levels.json");

  await generateGraph(credentials, {
    legacySvgPath: svgPath,
    darkSvgPath,
    lightSvgPath,
    levelsPath
  });
  process.stdout.write(`Generated ${svgPath}\n`);
  process.stdout.write(`Generated ${darkSvgPath}\n`);
  process.stdout.write(`Generated ${lightSvgPath}\n`);
  process.stdout.write(`Generated ${levelsPath}\n`);
}

const isEntrypoint = process.argv[1]
  ? resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isEntrypoint) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
