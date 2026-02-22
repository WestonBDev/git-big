import { readdir, readFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { refreshAccessToken, type StravaCredentials } from "../src/fetch.js";

interface UploadResult {
  file: string;
  status: "ok" | "duplicate" | "error";
  detail: string;
}

async function uploadFile(
  accessToken: string,
  filePath: string,
  dataType: string
): Promise<{ status: number; body: unknown }> {
  const fileContent = await readFile(filePath);
  const fileName = filePath.split("/").pop() ?? "activity";

  const form = new FormData();
  form.append("file", new Blob([fileContent]), fileName);
  form.append("data_type", dataType);

  const response = await fetch("https://www.strava.com/api/v3/uploads", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  return { status: response.status, body };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const tcxDir = process.argv[2];
  const gpxDir = process.argv[3];

  if (!tcxDir) {
    process.stderr.write(
      "Usage: npx tsx scripts/upload-to-strava.ts <tcx-dir> [gpx-dir]\n"
    );
    process.exitCode = 1;
    return;
  }

  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  const refreshToken = process.env.STRAVA_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    process.stderr.write(
      "Missing env vars: STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REFRESH_TOKEN\n"
    );
    process.exitCode = 1;
    return;
  }

  const credentials: StravaCredentials = { clientId, clientSecret, refreshToken };
  process.stdout.write("Refreshing Strava access token...\n");
  const accessToken = await refreshAccessToken(credentials);
  process.stdout.write("Authenticated.\n\n");

  const files: { path: string; dataType: string }[] = [];

  const tcxFiles = (await readdir(tcxDir)).filter((f) => extname(f) === ".tcx").sort();
  for (const f of tcxFiles) {
    files.push({ path: join(tcxDir, f), dataType: "tcx" });
  }

  if (gpxDir) {
    const gpxFiles = (await readdir(gpxDir)).filter((f) => extname(f) === ".gpx").sort();
    for (const f of gpxFiles) {
      files.push({ path: join(gpxDir, f), dataType: "gpx" });
    }
  }

  process.stdout.write(`Found ${files.length} files to upload.\n\n`);

  const results: UploadResult[] = [];
  let ok = 0;
  let duplicates = 0;
  let errors = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i]!;
    const name = file.path.split("/").pop()!;
    const progress = `[${i + 1}/${files.length}]`;

    try {
      const { status, body } = await uploadFile(accessToken, file.path, file.dataType);
      const bodyObj = body as Record<string, unknown> | null;

      if (status === 201) {
        process.stdout.write(`${progress} ${name} -- uploaded\n`);
        results.push({ file: name, status: "ok", detail: "uploaded" });
        ok++;
      } else if (status === 409 || (bodyObj && String(bodyObj.error).includes("duplicate"))) {
        process.stdout.write(`${progress} ${name} -- duplicate, skipped\n`);
        results.push({ file: name, status: "duplicate", detail: "already exists" });
        duplicates++;
      } else if (status === 429) {
        process.stdout.write(`${progress} ${name} -- rate limited, waiting 15 minutes...\n`);
        await sleep(15 * 60 * 1000);
        i--; // retry this file
        continue;
      } else {
        const msg = bodyObj ? JSON.stringify(bodyObj) : `HTTP ${status}`;
        process.stdout.write(`${progress} ${name} -- error: ${msg}\n`);
        results.push({ file: name, status: "error", detail: msg });
        errors++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stdout.write(`${progress} ${name} -- error: ${msg}\n`);
      results.push({ file: name, status: "error", detail: msg });
      errors++;
    }

    // Small delay to avoid hammering the API
    if (i < files.length - 1) {
      await sleep(1500);
    }
  }

  process.stdout.write(
    `\nDone.\n` +
    `  Uploaded:   ${ok}\n` +
    `  Duplicates: ${duplicates}\n` +
    `  Errors:     ${errors}\n`
  );
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`${msg}\n`);
  process.exitCode = 1;
});
