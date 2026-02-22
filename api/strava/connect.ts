import type { VercelRequest, VercelResponse } from "@vercel/node";

import { normalizeGithubLogin } from "../../src/hosted/github.js";
import { getSingleQueryParam, publicBaseUrl, requiredEnv } from "../../src/hosted/http.js";
import { createOAuthStateToken } from "../../src/hosted/state.js";
import { buildStravaAuthorizeUrl } from "../../src/setup.js";

export default function handler(req: VercelRequest, res: VercelResponse): void {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const githubParam = getSingleQueryParam(req.query, "github");
    if (!githubParam) {
      res.status(400).json({ error: "Missing required query parameter: github" });
      return;
    }

    const githubLogin = normalizeGithubLogin(githubParam);
    const redirectPath = getSingleQueryParam(req.query, "redirect");

    const baseUrl = publicBaseUrl(req);
    const redirectUri = `${baseUrl}/api/strava/callback`;
    const state = createOAuthStateToken(
      {
        githubLogin,
        redirectPath: redirectPath?.startsWith("/") ? redirectPath : undefined
      },
      requiredEnv("FITHUB_STATE_SECRET")
    );

    const authorizeUrl = new URL(
      buildStravaAuthorizeUrl(requiredEnv("STRAVA_CLIENT_ID"), redirectUri, "activity:read_all")
    );
    authorizeUrl.searchParams.set("state", state);
    authorizeUrl.searchParams.set("approval_prompt", "auto");

    res.status(302).setHeader("Location", authorizeUrl.toString()).end();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
}
