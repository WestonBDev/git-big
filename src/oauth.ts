export function extractAuthCode(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Could not find Strava OAuth code in provided input.");
  }

  if (/^https?:\/\//i.test(trimmed)) {
    const parsed = new URL(trimmed);
    const code = parsed.searchParams.get("code")?.trim();
    if (code) {
      return code;
    }

    throw new Error("Could not find Strava OAuth code in provided input.");
  }

  return trimmed;
}
