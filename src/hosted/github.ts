const GITHUB_LOGIN_PATTERN = /^[A-Za-z0-9-]{1,39}$/;

export function normalizeGithubLogin(input: string): string {
  const trimmed = input.trim();
  if (!GITHUB_LOGIN_PATTERN.test(trimmed)) {
    throw new Error("GitHub login must be 1-39 chars and contain only letters, numbers, or hyphens.");
  }

  return trimmed;
}
