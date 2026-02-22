import { Redis } from "@upstash/redis";

import type { GraphTheme } from "../render.js";
import { normalizeGithubLogin } from "./github.js";
import type { HostedAthleteRecord, HostedGraphCacheRecord, HostedStore } from "./types.js";

const ATHLETE_INDEX_KEY = "fithub:athletes:index";
const GRAPH_CACHE_TTL_SECONDS = 60 * 60 * 24 * 14;

function athleteKey(githubLogin: string): string {
  return `fithub:athlete:${normalizeGithubLogin(githubLogin).toLowerCase()}`;
}

function graphCacheKey(githubLogin: string, theme: GraphTheme): string {
  return `fithub:graph:${normalizeGithubLogin(githubLogin).toLowerCase()}:${theme}`;
}

export class UpstashHostedStore implements HostedStore {
  constructor(private readonly redis: Redis) {}

  static fromEnvironment(): UpstashHostedStore {
    return new UpstashHostedStore(Redis.fromEnv());
  }

  async getAthlete(githubLogin: string): Promise<HostedAthleteRecord | null> {
    const record = await this.redis.get<HostedAthleteRecord>(athleteKey(githubLogin));
    return record ?? null;
  }

  async upsertAthlete(record: HostedAthleteRecord): Promise<void> {
    const githubLogin = normalizeGithubLogin(record.githubLogin);
    await Promise.all([
      this.redis.set(athleteKey(githubLogin), {
        ...record,
        githubLogin
      }),
      this.redis.sadd(ATHLETE_INDEX_KEY, githubLogin)
    ]);
  }

  async listAthleteLogins(): Promise<string[]> {
    const values = await this.redis.smembers<string[]>(ATHLETE_INDEX_KEY);
    if (!Array.isArray(values)) {
      return [];
    }

    return values
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => normalizeGithubLogin(entry));
  }

  async getGraphCache(githubLogin: string, theme: GraphTheme): Promise<HostedGraphCacheRecord | null> {
    const record = await this.redis.get<HostedGraphCacheRecord>(graphCacheKey(githubLogin, theme));
    return record ?? null;
  }

  async setGraphCache(
    githubLogin: string,
    theme: GraphTheme,
    record: HostedGraphCacheRecord
  ): Promise<void> {
    await this.redis.set(graphCacheKey(githubLogin, theme), record, {
      ex: GRAPH_CACHE_TTL_SECONDS
    });
  }
}
