import { addDaysUtc, endOfWeekSaturday, formatDateUtc, startOfUtcDay, startOfWeekSunday } from "../date.js";
import { fetchLastYearActivitiesWithRefreshToken } from "../fetch.js";
import {
  aggregateMinutesByDate,
  fillDateRange,
  normalizeMinutesByDate
} from "../normalize.js";
import { renderContributionGraph, type GraphTheme } from "../render.js";
import { decryptTokenSecret, encryptTokenSecret } from "./crypto.js";
import { normalizeGithubLogin } from "./github.js";
import type { HostedStore } from "./types.js";

export interface HostedGraphRequest {
  githubLogin: string;
  theme: GraphTheme;
  store: HostedStore;
  stravaClientId: string;
  stravaClientSecret: string;
  tokenEncryptionKey: string;
  endDate?: Date;
  fetchImpl?: typeof fetch;
}

export interface HostedGraphResponse {
  svg: string;
  date: string;
  source: "cache" | "refresh" | "stale-cache";
}

export interface HostedRefreshSummary {
  processed: number;
  succeeded: number;
  failed: number;
  errors: string[];
}

interface HostedRefreshResult {
  date: string;
  darkSvg: string;
  lightSvg: string;
}

async function runWithConcurrency<T>(
  values: ReadonlyArray<T>,
  concurrency: number,
  worker: (value: T) => Promise<void>
): Promise<void> {
  if (values.length === 0) {
    return;
  }

  const boundedConcurrency = Math.max(1, Math.floor(concurrency));
  let nextIndex = 0;

  const workers = Array.from({ length: Math.min(boundedConcurrency, values.length) }, async () => {
    while (nextIndex < values.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      const value = values[currentIndex];
      if (value === undefined) {
        continue;
      }

      await worker(value);
    }
  });

  await Promise.all(workers);
}

function normalizeRenderDate(endDate: Date | undefined): Date {
  return startOfUtcDay(endDate ?? new Date());
}

async function refreshAthleteCaches(options: HostedGraphRequest): Promise<HostedRefreshResult> {
  const githubLogin = normalizeGithubLogin(options.githubLogin);
  const athlete = await options.store.getAthlete(githubLogin);
  if (!athlete) {
    throw new Error(`GitHub login is not connected to Strava: ${githubLogin}`);
  }

  const endDate = normalizeRenderDate(options.endDate);
  const dateKey = formatDateUtc(endDate);
  const refreshToken = decryptTokenSecret(athlete.encryptedRefreshToken, options.tokenEncryptionKey);

  const { activities, refreshToken: rotatedRefreshToken } = await fetchLastYearActivitiesWithRefreshToken(
    {
      clientId: options.stravaClientId,
      clientSecret: options.stravaClientSecret,
      refreshToken
    },
    endDate,
    options.fetchImpl ?? fetch
  );

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

  const nowIso = new Date().toISOString();
  await options.store.upsertAthlete({
    githubLogin,
    encryptedRefreshToken: encryptTokenSecret(rotatedRefreshToken, options.tokenEncryptionKey),
    updatedAtIso: nowIso
  });

  await Promise.all([
    options.store.setGraphCache(githubLogin, "dark", {
      date: dateKey,
      generatedAtIso: nowIso,
      svg: darkSvg
    }),
    options.store.setGraphCache(githubLogin, "light", {
      date: dateKey,
      generatedAtIso: nowIso,
      svg: lightSvg
    })
  ]);

  return {
    date: dateKey,
    darkSvg,
    lightSvg
  };
}

export async function getHostedGraphSvg(options: HostedGraphRequest): Promise<HostedGraphResponse> {
  const githubLogin = normalizeGithubLogin(options.githubLogin);
  const theme = options.theme;
  const endDate = normalizeRenderDate(options.endDate);
  const todayKey = formatDateUtc(endDate);

  const cache = await options.store.getGraphCache(githubLogin, theme);
  if (cache && cache.date === todayKey) {
    return {
      svg: cache.svg,
      date: cache.date,
      source: "cache"
    };
  }

  try {
    const refreshed = await refreshAthleteCaches({
      ...options,
      githubLogin,
      endDate
    });

    return {
      svg: theme === "dark" ? refreshed.darkSvg : refreshed.lightSvg,
      date: refreshed.date,
      source: "refresh"
    };
  } catch (error) {
    if (cache) {
      return {
        svg: cache.svg,
        date: cache.date,
        source: "stale-cache"
      };
    }

    throw error;
  }
}

export async function refreshAllHostedGraphs(options: {
  store: HostedStore;
  stravaClientId: string;
  stravaClientSecret: string;
  tokenEncryptionKey: string;
  endDate?: Date;
  fetchImpl?: typeof fetch;
  concurrency?: number;
}): Promise<HostedRefreshSummary> {
  const logins = await options.store.listAthleteLogins();
  const errors: string[] = [];

  let succeeded = 0;
  await runWithConcurrency(logins, options.concurrency ?? 4, async (githubLogin) => {
    try {
      await refreshAthleteCaches({
        githubLogin,
        theme: "dark",
        store: options.store,
        stravaClientId: options.stravaClientId,
        stravaClientSecret: options.stravaClientSecret,
        tokenEncryptionKey: options.tokenEncryptionKey,
        endDate: options.endDate,
        fetchImpl: options.fetchImpl
      });
      succeeded += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${githubLogin}: ${message}`);
    }
  });

  return {
    processed: logins.length,
    succeeded,
    failed: logins.length - succeeded,
    errors
  };
}
