import { MemoryHostedStore } from "./store-memory.js";
import { UpstashHostedStore } from "./store-upstash.js";
import type { HostedStore } from "./types.js";

let memoryStoreSingleton: MemoryHostedStore | undefined;

export function createHostedStore(env: NodeJS.ProcessEnv = process.env): HostedStore {
  const hasUpstash = Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
  if (hasUpstash) {
    return UpstashHostedStore.fromEnvironment();
  }

  if (!memoryStoreSingleton) {
    memoryStoreSingleton = new MemoryHostedStore();
  }

  return memoryStoreSingleton;
}
