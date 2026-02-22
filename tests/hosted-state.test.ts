import { describe, expect, it } from "vitest";

import { createOAuthStateToken, verifyOAuthStateToken } from "../src/hosted/state.js";

describe("hosted oauth state", () => {
  const secret = "unit-test-state-secret";

  it("round trips signed state payload", () => {
    const now = new Date("2026-02-22T00:00:00Z");
    const token = createOAuthStateToken(
      {
        githubLogin: "WestonBDev",
        redirectPath: "/done"
      },
      secret,
      now,
      600
    );

    const payload = verifyOAuthStateToken(token, secret, new Date("2026-02-22T00:05:00Z"));
    expect(payload.githubLogin).toBe("WestonBDev");
    expect(payload.redirectPath).toBe("/done");
  });

  it("rejects tampered tokens", () => {
    const now = new Date("2026-02-22T00:00:00Z");
    const token = createOAuthStateToken(
      {
        githubLogin: "WestonBDev"
      },
      secret,
      now,
      600
    );

    const tampered = `${token.slice(0, -1)}x`;
    expect(() =>
      verifyOAuthStateToken(tampered, secret, new Date("2026-02-22T00:05:00Z"))
    ).toThrowError("Invalid OAuth state signature.");
  });

  it("rejects expired tokens", () => {
    const now = new Date("2026-02-22T00:00:00Z");
    const token = createOAuthStateToken(
      {
        githubLogin: "WestonBDev"
      },
      secret,
      now,
      60
    );

    expect(() =>
      verifyOAuthStateToken(token, secret, new Date("2026-02-22T00:02:00Z"))
    ).toThrowError("OAuth state token expired.");
  });

  it("rejects malformed token structure", () => {
    expect(() => verifyOAuthStateToken("not-a-token", secret)).toThrowError(
      "Invalid OAuth state token."
    );
  });

  it("rejects missing secret and invalid ttl", () => {
    expect(() =>
      createOAuthStateToken(
        {
          githubLogin: "WestonBDev"
        },
        "",
        new Date("2026-02-22T00:00:00Z"),
        600
      )
    ).toThrowError("State secret is required.");

    expect(() =>
      createOAuthStateToken(
        {
          githubLogin: "WestonBDev"
        },
        secret,
        new Date("2026-02-22T00:00:00Z"),
        0
      )
    ).toThrowError("State token TTL must be a positive number.");
  });
});
