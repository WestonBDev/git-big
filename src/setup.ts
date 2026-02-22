const DEFAULT_REDIRECT_URI = "http://localhost/exchange_token";
const DEFAULT_SCOPE = "activity:read_all";

const GITHUB_SLUG_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export function buildStravaAuthorizeUrl(
  clientId: string,
  redirectUri: string = DEFAULT_REDIRECT_URI,
  scope: string = DEFAULT_SCOPE
): string {
  const url = new URL("https://www.strava.com/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("approval_prompt", "force");
  url.searchParams.set("scope", scope);
  return url.toString();
}

export function parseRepoSlug(remoteUrl: string): string | null {
  const trimmed = remoteUrl.trim();
  if (!trimmed) {
    return null;
  }

  const patterns = [
    /^git@github\.com:([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?$/,
    /^https:\/\/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?\/?$/,
    /^ssh:\/\/git@github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?\/?$/
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    const slug = match?.[1];
    if (slug) {
      return slug;
    }
  }

  return null;
}

export function validateRepoSlug(value: string): string {
  const trimmed = value.trim();
  if (!GITHUB_SLUG_PATTERN.test(trimmed)) {
    throw new Error("Repository must be in owner/name format.");
  }

  return trimmed;
}

export function isAffirmative(input: string, defaultValue: boolean): boolean {
  const normalized = input.trim().toLowerCase();
  if (!normalized) {
    return defaultValue;
  }

  if (["y", "yes", "true", "1"].includes(normalized)) {
    return true;
  }

  if (["n", "no", "false", "0"].includes(normalized)) {
    return false;
  }

  return defaultValue;
}

export function buildWidgetMarkdown(repoSlug: string, branch: string = "main"): string {
  return `![Fitness Graph](https://raw.githubusercontent.com/${repoSlug}/${branch}/dist/git-big.svg)`;
}

export function buildThemeAwareWidgetMarkdown(repoSlug: string, branch: string = "main"): string {
  const baseUrl = `https://raw.githubusercontent.com/${repoSlug}/${branch}/dist`;
  return [
    `![Fitness Graph](<${baseUrl}/git-big-light.svg#gh-light-mode-only>)`,
    `![Fitness Graph](<${baseUrl}/git-big-dark.svg#gh-dark-mode-only>)`
  ].join("\n");
}

export function buildHostedWidgetMarkdown(baseUrl: string, githubLogin: string): string {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const pathLogin = encodeURIComponent(githubLogin.trim());
  return [
    `![Fitness Graph](<${normalizedBase}/api/graph/${pathLogin}.svg?theme=light#gh-light-mode-only>)`,
    `![Fitness Graph](<${normalizedBase}/api/graph/${pathLogin}.svg?theme=dark#gh-dark-mode-only>)`
  ].join("\n");
}
