import { describe, expect, it, vi } from "vitest";

import { exchangeAuthorizationCode } from "../src/strava-auth.js";

describe("exchangeAuthorizationCode", () => {
  it("returns token payload", async () => {
    const mockFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          access_token: "access_1",
          refresh_token: "refresh_1",
          expires_at: 12345
        }),
        { status: 200 }
      )
    );

    const result = await exchangeAuthorizationCode(
      {
        clientId: "client_1",
        clientSecret: "secret_1",
        code: "code_1"
      },
      mockFetch as unknown as typeof fetch
    );

    expect(result.accessToken).toBe("access_1");
    expect(result.refreshToken).toBe("refresh_1");
  });

  it("throws on invalid payload", async () => {
    const mockFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          access_token: "access_1"
        }),
        { status: 200 }
      )
    );

    await expect(
      exchangeAuthorizationCode(
        {
          clientId: "client_1",
          clientSecret: "secret_1",
          code: "code_1"
        },
        mockFetch as unknown as typeof fetch
      )
    ).rejects.toThrowError("Strava OAuth token response did not include access_token and refresh_token.");
  });
});
