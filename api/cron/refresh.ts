import type { VercelRequest, VercelResponse } from "@vercel/node";

import { getSingleQueryParam, requiredEnv } from "../../src/hosted/http.js";
import { refreshAllHostedGraphs } from "../../src/hosted/service.js";
import { createHostedStore } from "../../src/hosted/store.js";

function isAuthorized(req: VercelRequest): boolean {
  const configuredSecrets = [process.env.FITHUB_CRON_SECRET, process.env.CRON_SECRET]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  if (configuredSecrets.length === 0) {
    return false;
  }

  const authHeader = req.headers.authorization;
  if (authHeader && configuredSecrets.some((secret) => authHeader === `Bearer ${secret}`)) {
    return true;
  }

  const querySecret = getSingleQueryParam(req.query, "secret");
  return Boolean(querySecret && configuredSecrets.includes(querySecret));
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!isAuthorized(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const summary = await refreshAllHostedGraphs({
      store: createHostedStore(),
      stravaClientId: requiredEnv("STRAVA_CLIENT_ID"),
      stravaClientSecret: requiredEnv("STRAVA_CLIENT_SECRET"),
      tokenEncryptionKey: requiredEnv("FITHUB_TOKEN_ENCRYPTION_KEY")
    });

    res.status(200).json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
}
