import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { addDaysUtc, endOfWeekSaturday, startOfUtcDay, startOfWeekSunday } from "./date.js";
import { fetchLastYearActivitiesWithRefreshToken, type StravaCredentials } from "./fetch.js";
import {
  aggregateMinutesByDate,
  fillDateRange,
  normalizeMinutesByDate
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
    throw new Error(`Invalid GITBIG_END_DATE value: ${configuredEndDate}`);
  }

  return startOfUtcDay(parsed);
}

async function generateGraph(
  credentials: StravaCredentials,
  outputPaths: {
    svgPath: string;
    darkSvgPath: string;
    lightSvgPath: string;
    levelsPath: string;
    legacyOutputPaths?: {
      svgPath: string;
      darkSvgPath: string;
      lightSvgPath: string;
      levelsPath: string;
    };
  }
): Promise<void> {
  const endDate = parseEndDate(process.env.GITBIG_END_DATE ?? process.env.FITHUB_END_DATE);
  const refreshTokenOutputPath =
    process.env.GITBIG_REFRESH_TOKEN_OUTPUT ?? process.env.FITHUB_REFRESH_TOKEN_OUTPUT;

  const { activities, refreshToken } = await fetchLastYearActivitiesWithRefreshToken(credentials, endDate);
  const minutesByDate = aggregateMinutesByDate(activities);
  const yearStart = addDaysUtc(endDate, -364);
  const lastYearMinutesByDate = fillDateRange(minutesByDate, yearStart, endDate);
  const lastYearLevelsByDate = normalizeMinutesByDate(lastYearMinutesByDate);

  const renderStart = startOfWeekSunday(addDaysUtc(endDate, -364));
  const renderEnd = endOfWeekSaturday(endDate);
  const filledMinutesByDate = fillDateRange(minutesByDate, renderStart, renderEnd);
  const filledLevelsByDate = fillDateRange(lastYearLevelsByDate, renderStart, renderEnd);

  const darkSvg = renderContributionGraph({
    levelsByDate: filledLevelsByDate,
    minutesByDate: filledMinutesByDate,
    sessionCount: activities.length,
    endDate,
    theme: "dark"
  });

  const lightSvg = renderContributionGraph({
    levelsByDate: filledLevelsByDate,
    minutesByDate: filledMinutesByDate,
    sessionCount: activities.length,
    endDate,
    theme: "light"
  });

  await mkdir(dirname(outputPaths.svgPath), { recursive: true });
  await Promise.all([
    writeFile(outputPaths.svgPath, darkSvg, "utf8"),
    writeFile(outputPaths.darkSvgPath, darkSvg, "utf8"),
    writeFile(outputPaths.lightSvgPath, lightSvg, "utf8"),
    writeFile(outputPaths.levelsPath, `${JSON.stringify(lastYearLevelsByDate, null, 2)}\n`, "utf8")
  ]);

  if (outputPaths.legacyOutputPaths) {
    await Promise.all([
      writeFile(outputPaths.legacyOutputPaths.svgPath, darkSvg, "utf8"),
      writeFile(outputPaths.legacyOutputPaths.darkSvgPath, darkSvg, "utf8"),
      writeFile(outputPaths.legacyOutputPaths.lightSvgPath, lightSvg, "utf8"),
      writeFile(
        outputPaths.legacyOutputPaths.levelsPath,
        `${JSON.stringify(lastYearLevelsByDate, null, 2)}\n`,
        "utf8"
      )
    ]);
  }

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

  const svgPath = resolve(process.cwd(), "dist", "git-big.svg");
  const darkSvgPath = resolve(process.cwd(), "dist", "git-big-dark.svg");
  const lightSvgPath = resolve(process.cwd(), "dist", "git-big-light.svg");
  const levelsPath = resolve(process.cwd(), "dist", "git-big-levels.json");

  await generateGraph(credentials, {
    svgPath,
    darkSvgPath,
    lightSvgPath,
    levelsPath,
    legacyOutputPaths: {
      svgPath: resolve(process.cwd(), "dist", "fithub.svg"),
      darkSvgPath: resolve(process.cwd(), "dist", "fithub-dark.svg"),
      lightSvgPath: resolve(process.cwd(), "dist", "fithub-light.svg"),
      levelsPath: resolve(process.cwd(), "dist", "fithub-levels.json")
    }
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
