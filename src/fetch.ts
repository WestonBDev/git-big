import { addDaysUtc, startOfUtcDay } from "./date.js";

export interface StravaCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

export interface StravaActivity {
  id: number;
  moving_time: number;
  start_date_local: string;
  [key: string]: unknown;
}

export interface StravaTokenBundle {
  accessToken: string;
  refreshToken: string;
}

export interface FetchActivitiesOptions {
  after: Date;
  before: Date;
  perPage?: number;
  fetchImpl?: typeof fetch;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function hasTokenBundle(payload: unknown): payload is { access_token: string; refresh_token: string } {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as { access_token?: unknown; refresh_token?: unknown };
  return typeof candidate.access_token === "string" && typeof candidate.refresh_token === "string";
}

export async function refreshAccessTokenBundle(
  credentials: StravaCredentials,
  fetchImpl: typeof fetch = fetch
): Promise<StravaTokenBundle> {
  const body = new URLSearchParams({
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
    refresh_token: credentials.refreshToken,
    grant_type: "refresh_token"
  });

  const response = await fetchImpl("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  const payload = await readJson(response);

  if (!response.ok) {
    throw new Error(`Strava token refresh failed (${response.status}): ${JSON.stringify(payload)}`);
  }

  if (!hasTokenBundle(payload)) {
    throw new Error("Strava token refresh response did not include access_token and refresh_token");
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token
  };
}

export async function refreshAccessToken(
  credentials: StravaCredentials,
  fetchImpl: typeof fetch = fetch
): Promise<string> {
  const tokenBundle = await refreshAccessTokenBundle(credentials, fetchImpl);
  return tokenBundle.accessToken;
}

export async function fetchActivities(
  accessToken: string,
  options: FetchActivitiesOptions
): Promise<StravaActivity[]> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const perPage = options.perPage ?? 200;
  const after = Math.floor(options.after.getTime() / 1000);
  const before = Math.floor(options.before.getTime() / 1000);

  const allActivities: StravaActivity[] = [];

  for (let page = 1; ; page += 1) {
    const url = new URL("https://www.strava.com/api/v3/athlete/activities");
    url.searchParams.set("after", `${after}`);
    url.searchParams.set("before", `${before}`);
    url.searchParams.set("page", `${page}`);
    url.searchParams.set("per_page", `${perPage}`);

    const response = await fetchImpl(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    const payload = await readJson(response);
    if (!response.ok) {
      throw new Error(`Strava activities fetch failed (${response.status}): ${JSON.stringify(payload)}`);
    }

    if (!Array.isArray(payload)) {
      throw new Error("Strava activities response was not an array");
    }

    const pageActivities = payload as StravaActivity[];
    allActivities.push(...pageActivities);

    if (pageActivities.length < perPage) {
      break;
    }
  }

  return allActivities;
}

export async function fetchLastYearActivities(
  credentials: StravaCredentials,
  endDate: Date = new Date(),
  fetchImpl: typeof fetch = fetch
): Promise<StravaActivity[]> {
  const result = await fetchLastYearActivitiesWithRefreshToken(credentials, endDate, fetchImpl);
  return result.activities;
}

export async function fetchLastYearActivitiesWithRefreshToken(
  credentials: StravaCredentials,
  endDate: Date = new Date(),
  fetchImpl: typeof fetch = fetch
): Promise<{ activities: StravaActivity[]; refreshToken: string }> {
  const endDay = startOfUtcDay(endDate);
  const startDay = addDaysUtc(endDay, -364);
  const endOfDay = new Date(addDaysUtc(endDay, 1).getTime() - 1_000);

  const tokenBundle = await refreshAccessTokenBundle(credentials, fetchImpl);
  const activities = await fetchActivities(tokenBundle.accessToken, {
    after: startDay,
    before: endOfDay,
    fetchImpl
  });

  return {
    activities,
    refreshToken: tokenBundle.refreshToken
  };
}
