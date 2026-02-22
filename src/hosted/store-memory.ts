import type { GraphTheme } from "../render.js";
import { normalizeGithubLogin } from "./github.js";
import type { HostedAthleteRecord, HostedGraphCacheRecord, HostedStore } from "./types.js";

function cacheKey(githubLogin: string, theme: GraphTheme): string {
  return `${normalizeGithubLogin(githubLogin).toLowerCase()}:${theme}`;
}

export class MemoryHostedStore implements HostedStore {
  private readonly athletes = new Map<string, HostedAthleteRecord>();
  private readonly graphCaches = new Map<string, HostedGraphCacheRecord>();

  async getAthlete(githubLogin: string): Promise<HostedAthleteRecord | null> {
    const key = normalizeGithubLogin(githubLogin).toLowerCase();
    return this.athletes.get(key) ?? null;
  }

  async upsertAthlete(record: HostedAthleteRecord): Promise<void> {
    const key = normalizeGithubLogin(record.githubLogin).toLowerCase();
    this.athletes.set(key, {
      ...record,
      githubLogin: normalizeGithubLogin(record.githubLogin)
    });
  }

  async listAthleteLogins(): Promise<string[]> {
    return Array.from(this.athletes.values(), (record) => record.githubLogin);
  }

  async getGraphCache(githubLogin: string, theme: GraphTheme): Promise<HostedGraphCacheRecord | null> {
    return this.graphCaches.get(cacheKey(githubLogin, theme)) ?? null;
  }

  async setGraphCache(
    githubLogin: string,
    theme: GraphTheme,
    record: HostedGraphCacheRecord
  ): Promise<void> {
    this.graphCaches.set(cacheKey(githubLogin, theme), record);
  }
}
