import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";

import { extractAuthCode } from "../src/oauth.js";
import { buildStravaAuthorizeUrl } from "../src/setup.js";
import { exchangeAuthorizationCode } from "../src/strava-auth.js";

function requiredValue(value: string | undefined, label: string): string {
  if (!value || !value.trim()) {
    throw new Error(`Missing required value: ${label}`);
  }

  return value.trim();
}

async function runGenerate(env: NodeJS.ProcessEnv): Promise<void> {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn("npm", ["run", "generate"], {
      stdio: "inherit",
      env
    });

    child.on("error", rejectPromise);
    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise();
      } else {
        rejectPromise(new Error(`Graph generation failed with exit code ${code ?? "unknown"}.`));
      }
    });
  });
}

async function validateArtifacts(cwd: string): Promise<{ totalDays: number; activeDays: number }> {
  const svgPath = resolve(cwd, "dist", "git-big.svg");
  const darkSvgPath = resolve(cwd, "dist", "git-big-dark.svg");
  const lightSvgPath = resolve(cwd, "dist", "git-big-light.svg");
  const levelsPath = resolve(cwd, "dist", "git-big-levels.json");

  await access(svgPath, constants.F_OK);
  await access(darkSvgPath, constants.F_OK);
  await access(lightSvgPath, constants.F_OK);
  await access(levelsPath, constants.F_OK);

  const [svg, darkSvg, lightSvg, levelsRaw] = await Promise.all([
    readFile(svgPath, "utf8"),
    readFile(darkSvgPath, "utf8"),
    readFile(lightSvgPath, "utf8"),
    readFile(levelsPath, "utf8")
  ]);

  if (!svg.startsWith("<svg")) {
    throw new Error("dist/git-big.svg is not a valid SVG root.");
  }

  if (!darkSvg.startsWith("<svg")) {
    throw new Error("dist/git-big-dark.svg is not a valid SVG root.");
  }

  if (!lightSvg.startsWith("<svg")) {
    throw new Error("dist/git-big-light.svg is not a valid SVG root.");
  }

  if (!svg.includes("data-date=")) {
    throw new Error("dist/git-big.svg does not contain day cells.");
  }

  if (darkSvg.includes('<rect width="100%" height="100%"')) {
    throw new Error("dist/git-big-dark.svg should not include a full-canvas background rect.");
  }

  if (lightSvg.includes('<rect width="100%" height="100%"')) {
    throw new Error("dist/git-big-light.svg should not include a full-canvas background rect.");
  }

  const parsedLevels = JSON.parse(levelsRaw) as Record<string, number>;
  const entries = Object.entries(parsedLevels).sort(([left], [right]) => left.localeCompare(right));

  if (entries.length < 365 || entries.length > 366) {
    throw new Error(`dist/git-big-levels.json expected 365-366 entries, got ${entries.length}.`);
  }

  const activeDays = entries.filter(([, value]) => value > 0).length;
  return {
    totalDays: entries.length,
    activeDays
  };
}

async function main(): Promise<void> {
  const cwd = process.cwd();
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    const clientId = requiredValue(
      process.env.STRAVA_CLIENT_ID ?? (await rl.question("Strava client id: ")),
      "STRAVA_CLIENT_ID"
    );
    const clientSecret = requiredValue(
      process.env.STRAVA_CLIENT_SECRET ?? (await rl.question("Strava client secret: ")),
      "STRAVA_CLIENT_SECRET"
    );

    process.stdout.write("\nOpen this URL, authorize the app, and paste the full redirect URL (or just code):\n\n");
    process.stdout.write(`${buildStravaAuthorizeUrl(clientId)}\n\n`);

    const oauthInput = await rl.question("Paste redirect URL or code: ");
    const code = extractAuthCode(oauthInput);

    const tokenResponse = await exchangeAuthorizationCode({
      clientId,
      clientSecret,
      code
    });

    process.stdout.write("\nToken exchange succeeded. Running graph generation...\n\n");

    await runGenerate({
      ...process.env,
      STRAVA_CLIENT_ID: clientId,
      STRAVA_CLIENT_SECRET: clientSecret,
      STRAVA_REFRESH_TOKEN: tokenResponse.refreshToken
    });

    const { totalDays, activeDays } = await validateArtifacts(cwd);
    process.stdout.write(
      `\nE2E passed. Artifacts validated: ${totalDays} days in JSON, ${activeDays} active days.\n`
    );
  } finally {
    rl.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
