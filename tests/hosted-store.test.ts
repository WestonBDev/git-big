import { afterEach, describe, expect, it, vi } from "vitest";

import { MemoryHostedStore } from "../src/hosted/store-memory.js";
import { createHostedStore } from "../src/hosted/store.js";
import { UpstashHostedStore } from "../src/hosted/store-upstash.js";

describe("hosted store factory", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a singleton memory store when upstash env is absent", () => {
    const env: NodeJS.ProcessEnv = {};
    const first = createHostedStore(env);
    const second = createHostedStore(env);

    expect(first).toBeInstanceOf(MemoryHostedStore);
    expect(second).toBe(first);
  });

  it("uses upstash store when redis env vars are present", () => {
    const sentinel = Object.create(UpstashHostedStore.prototype) as UpstashHostedStore;
    const spy = vi.spyOn(UpstashHostedStore, "fromEnvironment").mockReturnValue(sentinel);

    const env: NodeJS.ProcessEnv = {
      UPSTASH_REDIS_REST_URL: "https://redis.example",
      UPSTASH_REDIS_REST_TOKEN: "token"
    };
    const store = createHostedStore(env);

    expect(spy).toHaveBeenCalledOnce();
    expect(store).toBe(sentinel);
  });
});
