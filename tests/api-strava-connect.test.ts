import { afterEach, describe, expect, it } from "vitest";

import { verifyOAuthStateToken } from "../src/hosted/state.js";
import handler from "../api/strava/connect.js";
import { createMockRequest, createMockResponse } from "./test-utils/vercel.js";

describe("api /strava/connect", () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
  });

  it("rejects non-GET requests", () => {
    const req = createMockRequest({ method: "POST" });
    const { res, capture } = createMockResponse();

    handler(req, res);

    expect(capture.statusCode).toBe(405);
    expect(capture.jsonBody).toEqual({ error: "Method not allowed" });
  });

  it("rejects missing github query param", () => {
    process.env = {
      ...originalEnv,
      STRAVA_CLIENT_ID: "204011",
      GITBIG_STATE_SECRET: "state-secret"
    };

    const req = createMockRequest({
      query: {},
      headers: { host: "fithub.example" }
    });
    const { res, capture } = createMockResponse();

    handler(req, res);

    expect(capture.statusCode).toBe(400);
    expect(capture.jsonBody).toEqual({ error: "Missing required query parameter: github" });
  });

  it("builds strava authorize url with signed state", () => {
    process.env = {
      ...originalEnv,
      STRAVA_CLIENT_ID: "204011",
      GITBIG_STATE_SECRET: "state-secret"
    };

    const req = createMockRequest({
      query: {
        github: "WestonBDev",
        redirect: "/done"
      },
      headers: {
        "x-forwarded-proto": "https",
        "x-forwarded-host": "fithub.example"
      }
    });
    const { res, capture } = createMockResponse();

    handler(req, res);

    expect(capture.statusCode).toBe(302);

    const location = capture.headers.location;
    expect(location).toBeTruthy();

    const authorizeUrl = new URL(location ?? "");
    expect(authorizeUrl.origin).toBe("https://www.strava.com");
    expect(authorizeUrl.pathname).toBe("/oauth/authorize");
    expect(authorizeUrl.searchParams.get("client_id")).toBe("204011");
    expect(authorizeUrl.searchParams.get("scope")).toBe("activity:read_all");
    expect(authorizeUrl.searchParams.get("response_type")).toBe("code");
    expect(authorizeUrl.searchParams.get("approval_prompt")).toBe("auto");
    expect(authorizeUrl.searchParams.get("redirect_uri")).toBe("https://fithub.example/api/strava/callback");

    const state = authorizeUrl.searchParams.get("state");
    expect(state).toBeTruthy();

    const decoded = verifyOAuthStateToken(state ?? "", "state-secret");
    expect(decoded.githubLogin).toBe("WestonBDev");
    expect(decoded.redirectPath).toBe("/done");
  });

  it("ignores unsafe redirect values in state", () => {
    process.env = {
      ...originalEnv,
      STRAVA_CLIENT_ID: "204011",
      GITBIG_STATE_SECRET: "state-secret"
    };

    const req = createMockRequest({
      query: {
        github: "WestonBDev",
        redirect: "https://example.com"
      },
      headers: {
        host: "fithub.example"
      }
    });
    const { res, capture } = createMockResponse();

    handler(req, res);

    const location = capture.headers.location;
    expect(location).toBeTruthy();
    const authorizeUrl = new URL(location ?? "");
    const state = authorizeUrl.searchParams.get("state");
    const decoded = verifyOAuthStateToken(state ?? "", "state-secret");
    expect(decoded.redirectPath).toBeUndefined();
  });

  it("returns 500 when required env is missing", () => {
    process.env = {
      ...originalEnv,
      STRAVA_CLIENT_ID: "",
      GITBIG_STATE_SECRET: "state-secret"
    };

    const req = createMockRequest({
      query: {
        github: "WestonBDev"
      },
      headers: {
        host: "fithub.example"
      }
    });
    const { res, capture } = createMockResponse();

    handler(req, res);

    expect(capture.statusCode).toBe(500);
    expect(capture.jsonBody).toEqual({
      error: "Missing required environment variable: STRAVA_CLIENT_ID"
    });
  });
});
