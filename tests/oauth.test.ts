import { describe, expect, it } from "vitest";

import { extractAuthCode } from "../src/oauth.js";

describe("extractAuthCode", () => {
  it("extracts code from plain code string", () => {
    expect(extractAuthCode("abc123")).toBe("abc123");
  });

  it("extracts code from full redirect url", () => {
    expect(
      extractAuthCode(
        "http://localhost/exchange_token?state=&code=fit_code_987&scope=read,activity:read_all"
      )
    ).toBe("fit_code_987");
  });

  it("throws when code is missing", () => {
    expect(() =>
      extractAuthCode("http://localhost/exchange_token?state=&scope=read,activity:read_all")
    ).toThrowError("Could not find Strava OAuth code in provided input.");
  });
});
