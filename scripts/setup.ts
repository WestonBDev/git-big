import { spawn } from "node:child_process";
import { createInterface } from "node:readline/promises";

import { extractAuthCode } from "../src/oauth.js";
import {
  buildStravaAuthorizeUrl,
  buildThemeAwareWidgetMarkdown,
  isAffirmative,
  parseRepoSlug,
  validateRepoSlug
} from "../src/setup.js";
import { exchangeAuthorizationCode } from "../src/strava-auth.js";

async function runCommand(command: string, args: string[]): Promise<void> {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      env: process.env
    });

    child.on("error", rejectPromise);
    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise();
      } else {
        rejectPromise(new Error(`${command} ${args.join(" ")} failed with exit code ${code ?? "unknown"}.`));
      }
    });
  });
}

async function readCommandOutput(command: string, args: string[]): Promise<string> {
  return await new Promise<string>((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", rejectPromise);
    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise(stdout.trim());
      } else {
        rejectPromise(
          new Error(`${command} ${args.join(" ")} failed with exit code ${code ?? "unknown"}: ${stderr.trim()}`)
        );
      }
    });
  });
}

function requiredValue(value: string | undefined, label: string): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    throw new Error(`Missing required value: ${label}`);
  }

  return trimmed;
}

async function setRepoSecret(repo: string, name: string, value: string): Promise<void> {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn("gh", ["secret", "set", name, "--repo", repo], {
      stdio: ["pipe", "inherit", "inherit"],
      env: process.env
    });

    child.on("error", rejectPromise);
    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise();
      } else {
        rejectPromise(new Error(`gh secret set ${name} failed with exit code ${code ?? "unknown"}.`));
      }
    });

    child.stdin.write(value);
    child.stdin.end();
  });
}

async function detectRepoSlug(): Promise<string | null> {
  try {
    const remote = await readCommandOutput("git", ["remote", "get-url", "origin"]);
    return parseRepoSlug(remote);
  } catch {
    return null;
  }
}

async function ensureGhReady(): Promise<void> {
  await runCommand("gh", ["--version"]);
  await runCommand("gh", ["auth", "status"]);
}

async function main(): Promise<void> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    process.stdout.write("`git big` setup wizard\n\n");

    await ensureGhReady();

    const detectedRepo = await detectRepoSlug();
    const defaultRepo = process.env.GITHUB_REPOSITORY ?? detectedRepo ?? "";
    const repoInput = await rl.question(
      defaultRepo
        ? `GitHub repo (owner/name) [${defaultRepo}]: `
        : "GitHub repo (owner/name): "
    );
    const repo = validateRepoSlug(repoInput.trim() || defaultRepo);

    const clientId = requiredValue(
      process.env.STRAVA_CLIENT_ID ?? (await rl.question("Strava client id: ")),
      "STRAVA_CLIENT_ID"
    );
    const clientSecret = requiredValue(
      process.env.STRAVA_CLIENT_SECRET ?? (await rl.question("Strava client secret: ")),
      "STRAVA_CLIENT_SECRET"
    );

    const authorizeUrl = buildStravaAuthorizeUrl(clientId);
    process.stdout.write("\nOpen this URL, authorize the app, then paste the redirect URL (or code):\n\n");
    process.stdout.write(`${authorizeUrl}\n\n`);

    const oauthInput = await rl.question("Paste redirect URL or code: ");
    const code = extractAuthCode(oauthInput);

    const tokenResponse = await exchangeAuthorizationCode({
      clientId,
      clientSecret,
      code
    });

    const adminToken = (await rl.question(
      "GitHub PAT for REPO_ADMIN_TOKEN (optional, press Enter to skip): "
    )).trim();

    process.stdout.write("\nSaving repository secrets...\n");
    await setRepoSecret(repo, "STRAVA_CLIENT_ID", clientId);
    await setRepoSecret(repo, "STRAVA_CLIENT_SECRET", clientSecret);
    await setRepoSecret(repo, "STRAVA_REFRESH_TOKEN", tokenResponse.refreshToken);

    if (adminToken) {
      await setRepoSecret(repo, "REPO_ADMIN_TOKEN", adminToken);
    }

    const runWorkflowAnswer = await rl.question("Run 'Update Git Big Graph' workflow now? [Y/n]: ");
    if (isAffirmative(runWorkflowAnswer, true)) {
      await runCommand("gh", ["workflow", "run", "update.yml", "--repo", repo]);
      process.stdout.write("Triggered workflow: update.yml\n");
    }

    process.stdout.write("\nProfile README snippet:\n\n");
    process.stdout.write(`${buildThemeAwareWidgetMarkdown(repo)}\n`);
    process.stdout.write("\nSetup complete.\n");
  } finally {
    rl.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
