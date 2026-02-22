import { describe, expect, it } from "vitest";

import { encryptTokenSecret } from "../src/hosted/crypto.js";
import { MemoryHostedStore } from "../src/hosted/store-memory.js";
import { getHostedGraphSvg, refreshAllHostedGraphs } from "../src/hosted/service.js";

function createMockFetch(): {
  fetchImpl: typeof fetch;
  counts: {
    tokenRefresh: number;
    activities: number;
  };
} {
  const counts = {
    tokenRefresh: 0,
    activities: 0
  };

  const fetchImpl: typeof fetch = async (input: string | URL | Request): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

    if (url.includes("/oauth/token")) {
      counts.tokenRefresh += 1;
      return new Response(
        JSON.stringify({
          access_token: "access-token",
          refresh_token: "next-refresh-token"
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    if (url.includes("/api/v3/athlete/activities")) {
      counts.activities += 1;
      return new Response(
        JSON.stringify([
          {
            id: 1,
            moving_time: 3600,
            start_date_local: "2026-02-22T09:00:00Z"
          }
        ]),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    return new Response("not found", { status: 404 });
  };

  return {
    fetchImpl,
    counts
  };
}

describe("hosted graph service", () => {
  const encryptionKey = "1111111111111111111111111111111111111111111111111111111111111111";

  it("refreshes once and reuses same-day cache across themes", async () => {
    const store = new MemoryHostedStore();
    const encryptedSeedToken = encryptTokenSecret("seed-refresh-token", encryptionKey);
    await store.upsertAthlete({
      githubLogin: "WestonBDev",
      encryptedRefreshToken: encryptedSeedToken,
      updatedAtIso: "2026-02-21T00:00:00.000Z"
    });

    const mock = createMockFetch();
    const first = await getHostedGraphSvg({
      githubLogin: "WestonBDev",
      theme: "dark",
      store,
      stravaClientId: "123",
      stravaClientSecret: "secret",
      tokenEncryptionKey: encryptionKey,
      endDate: new Date("2026-02-22T00:00:00Z"),
      fetchImpl: mock.fetchImpl
    });

    expect(first.source).toBe("refresh");
    expect(first.svg.startsWith("<svg")).toBe(true);
    expect(mock.counts.tokenRefresh).toBe(1);
    expect(mock.counts.activities).toBe(1);

    const second = await getHostedGraphSvg({
      githubLogin: "WestonBDev",
      theme: "light",
      store,
      stravaClientId: "123",
      stravaClientSecret: "secret",
      tokenEncryptionKey: encryptionKey,
      endDate: new Date("2026-02-22T00:00:00Z"),
      fetchImpl: mock.fetchImpl
    });

    expect(second.source).toBe("cache");
    expect(second.svg.startsWith("<svg")).toBe(true);
    expect(mock.counts.tokenRefresh).toBe(1);
    expect(mock.counts.activities).toBe(1);
  });

  it("falls back to stale cache if refresh fails", async () => {
    const store = new MemoryHostedStore();
    const encryptedSeedToken = encryptTokenSecret("seed-refresh-token", encryptionKey);
    await store.upsertAthlete({
      githubLogin: "WestonBDev",
      encryptedRefreshToken: encryptedSeedToken,
      updatedAtIso: "2026-02-21T00:00:00.000Z"
    });
    await store.setGraphCache("WestonBDev", "dark", {
      date: "2026-02-21",
      svg: "<svg><title>stale</title></svg>",
      generatedAtIso: "2026-02-21T00:00:00.000Z"
    });

    const failingFetch: typeof fetch = async (): Promise<Response> => {
      return new Response(
        JSON.stringify({
          message: "rate limited"
        }),
        { status: 429, headers: { "content-type": "application/json" } }
      );
    };

    const result = await getHostedGraphSvg({
      githubLogin: "WestonBDev",
      theme: "dark",
      store,
      stravaClientId: "123",
      stravaClientSecret: "secret",
      tokenEncryptionKey: encryptionKey,
      endDate: new Date("2026-02-22T00:00:00Z"),
      fetchImpl: failingFetch
    });

    expect(result.source).toBe("stale-cache");
    expect(result.svg).toContain("stale");
  });

  it("refreshes all connected athletes with bounded concurrency", async () => {
    const store = new MemoryHostedStore();
    const encryptedSeedToken = encryptTokenSecret("seed-refresh-token", encryptionKey);

    await store.upsertAthlete({
      githubLogin: "WestonBDev",
      encryptedRefreshToken: encryptedSeedToken,
      updatedAtIso: "2026-02-21T00:00:00.000Z"
    });
    await store.upsertAthlete({
      githubLogin: "AnotherAthlete",
      encryptedRefreshToken: encryptedSeedToken,
      updatedAtIso: "2026-02-21T00:00:00.000Z"
    });

    const mock = createMockFetch();
    const summary = await refreshAllHostedGraphs({
      store,
      stravaClientId: "123",
      stravaClientSecret: "secret",
      tokenEncryptionKey: encryptionKey,
      endDate: new Date("2026-02-22T00:00:00Z"),
      concurrency: 2,
      fetchImpl: mock.fetchImpl
    });

    expect(summary).toEqual({
      processed: 2,
      succeeded: 2,
      failed: 0,
      errors: []
    });
    expect(mock.counts.tokenRefresh).toBe(2);
    expect(mock.counts.activities).toBe(2);

    expect(await store.getGraphCache("WestonBDev", "dark")).not.toBeNull();
    expect(await store.getGraphCache("WestonBDev", "light")).not.toBeNull();
    expect(await store.getGraphCache("AnotherAthlete", "dark")).not.toBeNull();
    expect(await store.getGraphCache("AnotherAthlete", "light")).not.toBeNull();
  });
});
