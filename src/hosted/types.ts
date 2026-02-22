import type { GraphTheme } from "../render.js";

export interface HostedAthleteRecord {
  githubLogin: string;
  encryptedRefreshToken: string;
  updatedAtIso: string;
}

export interface HostedGraphCacheRecord {
  date: string;
  generatedAtIso: string;
  svg: string;
}

export interface HostedStore {
  getAthlete(githubLogin: string): Promise<HostedAthleteRecord | null>;
  upsertAthlete(record: HostedAthleteRecord): Promise<void>;
  listAthleteLogins(): Promise<string[]>;
  getGraphCache(githubLogin: string, theme: GraphTheme): Promise<HostedGraphCacheRecord | null>;
  setGraphCache(githubLogin: string, theme: GraphTheme, record: HostedGraphCacheRecord): Promise<void>;
}
