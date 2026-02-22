import { describe, expect, it } from "vitest";

import { normalizeGithubLogin } from "../src/hosted/github.js";

describe("hosted github login normalization", () => {
  it("trims and returns valid github login", () => {
    expect(normalizeGithubLogin(" WestonBDev ")).toBe("WestonBDev");
  });

  it("rejects invalid github login values", () => {
    expect(() => normalizeGithubLogin("contains space")).toThrowError(
      "GitHub login must be 1-39 chars and contain only letters, numbers, or hyphens."
    );
    expect(() => normalizeGithubLogin("")).toThrowError(
      "GitHub login must be 1-39 chars and contain only letters, numbers, or hyphens."
    );
  });
});
