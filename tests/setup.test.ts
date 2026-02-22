import { describe, expect, it } from "vitest";

import {
  buildHostedWidgetMarkdown,
  buildThemeAwareWidgetMarkdown,
  buildStravaAuthorizeUrl,
  isAffirmative,
  parseRepoSlug
} from "../src/setup.js";

describe("setup helpers", () => {
  it("parses github repo slug from https remote", () => {
    expect(parseRepoSlug("https://github.com/WestonBDev/git-big.git")).toBe("WestonBDev/git-big");
  });

  it("parses github repo slug from ssh remote", () => {
    expect(parseRepoSlug("git@github.com:WestonBDev/git-big.git")).toBe("WestonBDev/git-big");
  });

  it("returns null for non-github remotes", () => {
    expect(parseRepoSlug("https://gitlab.com/acme/repo.git")).toBeNull();
  });

  it("builds Strava authorization URL", () => {
    const url = buildStravaAuthorizeUrl("12345");

    expect(url).toContain("https://www.strava.com/oauth/authorize");
    expect(url).toContain("client_id=12345");
    expect(url).toContain("redirect_uri=http%3A%2F%2Flocalhost%2Fexchange_token");
    expect(url).toContain("scope=activity%3Aread_all");
  });

  it("parses yes/no responses", () => {
    expect(isAffirmative("y", true)).toBe(true);
    expect(isAffirmative("yes", false)).toBe(true);
    expect(isAffirmative("", true)).toBe(true);
    expect(isAffirmative("", false)).toBe(false);
    expect(isAffirmative("n", true)).toBe(false);
  });

  it("builds theme-aware profile widget markdown", () => {
    const snippet = buildThemeAwareWidgetMarkdown("WestonBDev/git-big");

    expect(snippet).toContain("git-big-light.svg#gh-light-mode-only");
    expect(snippet).toContain("git-big-dark.svg#gh-dark-mode-only");
  });

  it("builds hosted profile widget markdown", () => {
    const snippet = buildHostedWidgetMarkdown("https://fithub.westonb.dev", "WestonBDev");

    expect(snippet).toContain("https://fithub.westonb.dev/api/graph/WestonBDev.svg?theme=light#gh-light-mode-only");
    expect(snippet).toContain("https://fithub.westonb.dev/api/graph/WestonBDev.svg?theme=dark#gh-dark-mode-only");
  });
});
