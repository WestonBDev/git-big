import { afterEach, describe, expect, it, vi } from "vitest";

import handler from "../api/strava/callback.js";
import { decryptTokenSecret } from "../src/hosted/crypto.js";
import { createOAuthStateToken } from "../src/hosted/state.js";
import { createHostedStore } from "../src/hosted/store.js";
import { createMockRequest, createMockResponse } from "./test-utils/vercel.js";

describe("api /strava/callback", () => {
  const originalEnv = process.env;
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    process.env = originalEnv;
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("rejects non-GET requests", async () => {
    const req = createMockRequest({ method: "POST" });
    const { res, capture } = createMockResponse();

    await handler(req, res);

    expect(capture.statusCode).toBe(405);
    expect(capture.jsonBody).toEqual({ error: "Method not allowed" });
  });

  it("rejects missing code/state", async () => {
    process.env = {
      ...originalEnv,
      FITHUB_STATE_SECRET: "state-secret"
    };

    const req = createMockRequest({ query: {} });
    const { res, capture } = createMockResponse();

    await handler(req, res);

    expect(capture.statusCode).toBe(400);
    expect(capture.jsonBody).toEqual({
      error: "Missing required query parameters: code and state"
    });
  });

  it("stores encrypted refresh token and returns embed snippet", async () => {
    process.env = {
      ...originalEnv,
      STRAVA_CLIENT_ID: "204011",
      STRAVA_CLIENT_SECRET: "client-secret",
      FITHUB_STATE_SECRET: "state-secret",
      FITHUB_TOKEN_ENCRYPTION_KEY: "1111111111111111111111111111111111111111111111111111111111111111",
      UPSTASH_REDIS_REST_URL: "",
      UPSTASH_REDIS_REST_TOKEN: ""
    };

    globalThis.fetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "access-token",
          refresh_token: "refresh-token"
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    const state = createOAuthStateToken(
      {
        githubLogin: "WestonBDev",
        redirectPath: "/done"
      },
      "state-secret"
    );

    const req = createMockRequest({
      query: {
        code: "auth-code-123",
        state
      },
      headers: {
        "x-forwarded-proto": "https",
        "x-forwarded-host": "fithub.example"
      }
    });
    const { res, capture } = createMockResponse();

    await handler(req, res);

    expect(capture.statusCode).toBe(200);
    expect(capture.headers["content-type"]).toBe("text/html; charset=utf-8");
    expect(capture.sentBody).toContain("FitHub connected for WestonBDev");
    expect(capture.sentBody).toContain("/api/graph/WestonBDev.svg?theme=light#gh-light-mode-only");
    expect(capture.sentBody).toContain("/api/strava/connect?github=WestonBDev");

    const store = createHostedStore();
    const athlete = await store.getAthlete("WestonBDev");
    expect(athlete).not.toBeNull();
    expect(athlete?.encryptedRefreshToken).not.toContain("refresh-token");

    const decrypted = decryptTokenSecret(
      athlete?.encryptedRefreshToken ?? "",
      process.env.FITHUB_TOKEN_ENCRYPTION_KEY ?? ""
    );
    expect(decrypted).toBe("refresh-token");
  });

  it("returns 400 when state token is invalid", async () => {
    process.env = {
      ...originalEnv,
      STRAVA_CLIENT_ID: "204011",
      STRAVA_CLIENT_SECRET: "client-secret",
      FITHUB_STATE_SECRET: "state-secret",
      FITHUB_TOKEN_ENCRYPTION_KEY: "1111111111111111111111111111111111111111111111111111111111111111",
      UPSTASH_REDIS_REST_URL: "",
      UPSTASH_REDIS_REST_TOKEN: ""
    };

    const req = createMockRequest({
      query: {
        code: "auth-code-123",
        state: "v1.bad.token"
      }
    });
    const { res, capture } = createMockResponse();

    await handler(req, res);

    expect(capture.statusCode).toBe(400);
    expect(capture.jsonBody).toEqual({ error: "Invalid OAuth state signature." });
  });

  it("returns 400 when strava code exchange fails", async () => {
    process.env = {
      ...originalEnv,
      STRAVA_CLIENT_ID: "204011",
      STRAVA_CLIENT_SECRET: "client-secret",
      FITHUB_STATE_SECRET: "state-secret",
      FITHUB_TOKEN_ENCRYPTION_KEY: "1111111111111111111111111111111111111111111111111111111111111111",
      UPSTASH_REDIS_REST_URL: "",
      UPSTASH_REDIS_REST_TOKEN: ""
    };

    globalThis.fetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          message: "bad code"
        }),
        { status: 400, headers: { "content-type": "application/json" } }
      )
    );

    const state = createOAuthStateToken(
      {
        githubLogin: "WestonBDev"
      },
      "state-secret"
    );

    const req = createMockRequest({
      query: {
        code: "bad-code",
        state
      }
    });
    const { res, capture } = createMockResponse();

    await handler(req, res);

    expect(capture.statusCode).toBe(400);
    expect(capture.jsonBody).toEqual({
      error: "Strava OAuth token exchange failed (400): {\"message\":\"bad code\"}"
    });
  });
});
