import { afterEach, describe, expect, it, vi } from "vitest";

import { Redis } from "@upstash/redis";

import { UpstashHostedStore } from "../src/hosted/store-upstash.js";
import type { HostedAthleteRecord, HostedGraphCacheRecord } from "../src/hosted/types.js";

interface SetCall {
  key: string;
  value: unknown;
  options?: {
    ex?: number;
  };
}

class FakeRedis {
  readonly getMap = new Map<string, unknown>();
  readonly setCalls: SetCall[] = [];
  readonly saddCalls: Array<{ key: string; value: string }> = [];
  smembersResult: unknown = [];

  async get<T>(key: string): Promise<T | null> {
    return (this.getMap.get(key) as T | undefined) ?? null;
  }

  async set(
    key: string,
    value: unknown,
    options?: {
      ex?: number;
    }
  ): Promise<void> {
    this.setCalls.push({ key, value, options });
    this.getMap.set(key, value);
  }

  async sadd(key: string, value: string): Promise<void> {
    this.saddCalls.push({ key, value });
  }

  async smembers<T>(): Promise<T> {
    return this.smembersResult as T;
  }
}

describe("upstash hosted store", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("constructs from redis environment", () => {
    const fakeRedis = new FakeRedis();
    const spy = vi.spyOn(Redis, "fromEnv").mockReturnValue(fakeRedis as unknown as Redis);

    const store = UpstashHostedStore.fromEnvironment();

    expect(spy).toHaveBeenCalledOnce();
    expect(store).toBeInstanceOf(UpstashHostedStore);
  });

  it("gets and upserts athlete records using normalized keys", async () => {
    const fakeRedis = new FakeRedis();
    const store = new UpstashHostedStore(fakeRedis as unknown as Redis);
    const record: HostedAthleteRecord = {
      githubLogin: "WestonBDev",
      encryptedRefreshToken: "enc:v1.payload",
      updatedAtIso: "2026-02-22T00:00:00.000Z"
    };

    await store.upsertAthlete(record);

    expect(fakeRedis.setCalls[0]).toEqual({
      key: "fithub:athlete:westonbdev",
      value: {
        ...record,
        githubLogin: "WestonBDev"
      },
      options: undefined
    });
    expect(fakeRedis.saddCalls).toEqual([
      { key: "fithub:athletes:index", value: "WestonBDev" }
    ]);

    const loaded = await store.getAthlete("westonbdev");
    expect(loaded).toEqual({
      ...record,
      githubLogin: "WestonBDev"
    });

    const missing = await store.getAthlete("missing-user");
    expect(missing).toBeNull();
  });

  it("normalizes listAthleteLogins and ignores unexpected payload shapes", async () => {
    const fakeRedis = new FakeRedis();
    const store = new UpstashHostedStore(fakeRedis as unknown as Redis);

    fakeRedis.smembersResult = ["WestonBDev", " another-user ", 10, null];
    const list = await store.listAthleteLogins();
    expect(list).toEqual(["WestonBDev", "another-user"]);

    fakeRedis.smembersResult = "not-an-array";
    const empty = await store.listAthleteLogins();
    expect(empty).toEqual([]);
  });

  it("gets and sets graph cache with ttl", async () => {
    const fakeRedis = new FakeRedis();
    const store = new UpstashHostedStore(fakeRedis as unknown as Redis);
    const cache: HostedGraphCacheRecord = {
      date: "2026-02-22",
      generatedAtIso: "2026-02-22T00:00:00.000Z",
      svg: "<svg />"
    };

    await store.setGraphCache("WestonBDev", "dark", cache);

    expect(fakeRedis.setCalls[0]).toEqual({
      key: "fithub:graph:westonbdev:dark",
      value: cache,
      options: { ex: 1209600 }
    });

    const loaded = await store.getGraphCache("westonbdev", "dark");
    expect(loaded).toEqual(cache);

    const missing = await store.getGraphCache("missing-user", "dark");
    expect(missing).toBeNull();
  });
});
