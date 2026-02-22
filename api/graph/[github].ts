import type { VercelRequest, VercelResponse } from "@vercel/node";

import { startOfUtcDay } from "../../src/date.js";
import { normalizeGithubLogin } from "../../src/hosted/github.js";
import { getSingleQueryParam, requiredEnv, requiredEnvAny } from "../../src/hosted/http.js";
import { getHostedGraphSvg } from "../../src/hosted/service.js";
import { createHostedStore } from "../../src/hosted/store.js";
import { renderContributionGraph, type GraphTheme } from "../../src/render.js";

function resolveTheme(input: string | undefined): GraphTheme {
  return input === "light" ? "light" : "dark";
}

function parseGithubLogin(raw: string): string {
  const trimmed = raw.trim();
  const withoutSvgSuffix = trimmed.endsWith(".svg")
    ? trimmed.slice(0, Math.max(0, trimmed.length - 4))
    : trimmed;
  return normalizeGithubLogin(withoutSvgSuffix);
}

function fallbackSvg(theme: GraphTheme): string {
  return renderContributionGraph({
    levelsByDate: {},
    endDate: startOfUtcDay(new Date()),
    theme,
    title: "git big not connected"
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const loginParam = getSingleQueryParam(req.query, "github");
  if (!loginParam) {
    res.status(400).json({ error: "Missing GitHub login in route." });
    return;
  }

  const theme = resolveTheme(getSingleQueryParam(req.query, "theme"));
  const githubLogin = parseGithubLogin(loginParam);

  try {
    const result = await getHostedGraphSvg({
      githubLogin,
      theme,
      store: createHostedStore(),
      stravaClientId: requiredEnv("STRAVA_CLIENT_ID"),
      stravaClientSecret: requiredEnv("STRAVA_CLIENT_SECRET"),
      tokenEncryptionKey: requiredEnvAny([
        "GITBIG_TOKEN_ENCRYPTION_KEY",
        "FITHUB_TOKEN_ENCRYPTION_KEY"
      ])
    });

    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400");
    res.setHeader("X-Git-Big-Source", result.source);
    res.setHeader("X-FitHub-Source", result.source);
    res.status(200).send(result.svg);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("is not connected to Strava")) {
      res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=60, s-maxage=60");
      res.setHeader("X-Git-Big-Source", "not-connected");
      res.setHeader("X-FitHub-Source", "not-connected");
      res.status(200).send(fallbackSvg(theme));
      return;
    }

    res.status(500).json({ error: message });
  }
}
