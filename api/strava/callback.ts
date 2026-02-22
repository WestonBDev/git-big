import type { VercelRequest, VercelResponse } from "@vercel/node";

import { decryptTokenSecret, encryptTokenSecret } from "../../src/hosted/crypto.js";
import { normalizeGithubLogin } from "../../src/hosted/github.js";
import {
  escapeHtml,
  getSingleQueryParam,
  publicBaseUrl,
  requiredEnv,
  requiredEnvAny
} from "../../src/hosted/http.js";
import { verifyOAuthStateToken } from "../../src/hosted/state.js";
import { createHostedStore } from "../../src/hosted/store.js";
import { buildHostedWidgetMarkdown } from "../../src/setup.js";
import { exchangeAuthorizationCode } from "../../src/strava-auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const code = getSingleQueryParam(req.query, "code");
    const stateToken = getSingleQueryParam(req.query, "state");
    if (!code || !stateToken) {
      res.status(400).json({ error: "Missing required query parameters: code and state" });
      return;
    }

    const state = verifyOAuthStateToken(
      stateToken,
      requiredEnvAny(["GITBIG_STATE_SECRET", "FITHUB_STATE_SECRET"])
    );
    const githubLogin = normalizeGithubLogin(state.githubLogin);

    const tokenResponse = await exchangeAuthorizationCode({
      clientId: requiredEnv("STRAVA_CLIENT_ID"),
      clientSecret: requiredEnv("STRAVA_CLIENT_SECRET"),
      code
    });

    const tokenEncryptionKey = requiredEnvAny([
      "GITBIG_TOKEN_ENCRYPTION_KEY",
      "FITHUB_TOKEN_ENCRYPTION_KEY"
    ]);
    const encryptedRefreshToken = encryptTokenSecret(tokenResponse.refreshToken, tokenEncryptionKey);
    const store = createHostedStore();

    await store.upsertAthlete({
      githubLogin,
      encryptedRefreshToken,
      updatedAtIso: new Date().toISOString()
    });

    // sanity check write path once during connect
    decryptTokenSecret(encryptedRefreshToken, tokenEncryptionKey);

    const baseUrl = publicBaseUrl(req);
    const snippet = buildHostedWidgetMarkdown(baseUrl, githubLogin);
    const escapedSnippet = escapeHtml(snippet);
    const escapedLogin = escapeHtml(githubLogin);
    const escapedConnectUrl = escapeHtml(`${baseUrl}/api/strava/connect?github=${githubLogin}`);

    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>git big connected</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, Arial, sans-serif; margin: 24px; color: #24292f; }
    code, pre { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    pre { background: #f6f8fa; border: 1px solid #d0d7de; border-radius: 6px; padding: 12px; overflow-x: auto; }
    a { color: #0969da; text-decoration: none; }
  </style>
</head>
<body>
  <h1><code>git big</code> connected for ${escapedLogin}</h1>
  <p>Paste this in your GitHub profile README:</p>
  <pre>${escapedSnippet}</pre>
  <p>Reconnect URL: <a href="${escapedConnectUrl}">${escapedConnectUrl}</a></p>
</body>
</html>`;

    res.status(200).setHeader("Content-Type", "text/html; charset=utf-8").send(html);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(400).json({ error: message });
  }
}
