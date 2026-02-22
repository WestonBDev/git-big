import { describe, expect, it, vi } from "vitest";

import {
  fetchActivities,
  fetchLastYearActivities,
  fetchLastYearActivitiesWithRefreshToken,
  refreshAccessTokenBundle,
  refreshAccessToken,
  type StravaCredentials
} from "../src/fetch.js";

const credentials: StravaCredentials = {
  clientId: "abc123",
  clientSecret: "secret456",
  refreshToken: "refresh789"
};

describe("fetch", () => {
  it("refreshes access token with Strava OAuth endpoint", async () => {
    const mockFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          access_token: "token_1",
          refresh_token: "refresh_new_1"
        }),
        { status: 200 }
      )
    );

    const token = await refreshAccessToken(credentials, mockFetch as unknown as typeof fetch);
    expect(token).toBe("token_1");

    const firstCall = mockFetch.mock.calls[0] as unknown[] | undefined;
    const request = firstCall?.[1] as RequestInit | undefined;
    expect(mockFetch).toHaveBeenCalledWith(
      "https://www.strava.com/oauth/token",
      expect.objectContaining({ method: "POST" })
    );

    const body = request?.body as URLSearchParams;
    expect(body.get("client_id")).toBe("abc123");
    expect(body.get("client_secret")).toBe("secret456");
    expect(body.get("refresh_token")).toBe("refresh789");
    expect(body.get("grant_type")).toBe("refresh_token");
  });

  it("returns access and refresh token bundle", async () => {
    const mockFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          access_token: "token_1",
          refresh_token: "refresh_new_1"
        }),
        { status: 200 }
      )
    );

    const bundle = await refreshAccessTokenBundle(credentials, mockFetch as unknown as typeof fetch);
    expect(bundle).toEqual({
      accessToken: "token_1",
      refreshToken: "refresh_new_1"
    });
  });

  it("paginates activity fetches until final page", async () => {
    const page1 = Array.from({ length: 200 }, (_, index) => ({
      id: index + 1,
      start_date_local: "2026-02-18T06:20:00Z",
      moving_time: 600
    }));

    const page2 = [
      {
        id: 201,
        start_date_local: "2026-02-19T06:20:00Z",
        moving_time: 900
      }
    ];

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(page1), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(page2), { status: 200 }));

    const activities = await fetchActivities("token_1", {
      after: new Date("2025-02-20T00:00:00Z"),
      before: new Date("2026-02-19T23:59:59Z"),
      fetchImpl: mockFetch as unknown as typeof fetch
    });

    expect(activities).toHaveLength(201);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[0]?.[0]).toContain("page=1");
    expect(mockFetch.mock.calls[1]?.[0]).toContain("page=2");
  });

  it("fetches last-year activities with token refresh", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "token_1",
            refresh_token: "refresh_new_1"
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              id: 1,
              start_date_local: "2026-02-18T06:20:00Z",
              moving_time: 600
            }
          ]),
          { status: 200 }
        )
      );

    const activities = await fetchLastYearActivities(
      credentials,
      new Date("2026-02-19T00:00:00Z"),
      mockFetch as unknown as typeof fetch
    );

    expect(activities).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("returns latest refresh token with last-year activities", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "token_1",
            refresh_token: "refresh_new_1"
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              id: 1,
              start_date_local: "2026-02-18T06:20:00Z",
              moving_time: 600
            }
          ]),
          { status: 200 }
        )
      );

    const result = await fetchLastYearActivitiesWithRefreshToken(
      credentials,
      new Date("2026-02-19T00:00:00Z"),
      mockFetch as unknown as typeof fetch
    );

    expect(result.refreshToken).toBe("refresh_new_1");
    expect(result.activities).toHaveLength(1);
  });
});
