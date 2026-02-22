import { afterEach, describe, expect, it, vi } from "vitest";

import handler from "../api/graph/[github].js";
import { createMockRequest, createMockResponse } from "./test-utils/vercel.js";

const mocks = vi.hoisted(() => {
  return {
    getHostedGraphSvg: vi.fn(),
    createHostedStore: vi.fn(() => ({ marker: "store" }))
  };
});

vi.mock("../src/hosted/service.js", () => {
  return {
    getHostedGraphSvg: mocks.getHostedGraphSvg
  };
});

vi.mock("../src/hosted/store.js", () => {
  return {
    createHostedStore: mocks.createHostedStore
  };
});

describe("api /graph/[github]", () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  it("rejects non-GET requests", async () => {
    const req = createMockRequest({ method: "POST" });
    const { res, capture } = createMockResponse();

    await handler(req, res);

    expect(capture.statusCode).toBe(405);
    expect(capture.jsonBody).toEqual({ error: "Method not allowed" });
  });

  it("rejects missing github login", async () => {
    const req = createMockRequest({ query: {} });
    const { res, capture } = createMockResponse();

    await handler(req, res);

    expect(capture.statusCode).toBe(400);
    expect(capture.jsonBody).toEqual({ error: "Missing GitHub login in route." });
  });

  it("returns rendered graph with cache headers", async () => {
    process.env = {
      ...originalEnv,
      STRAVA_CLIENT_ID: "204011",
      STRAVA_CLIENT_SECRET: "client-secret",
      GITBIG_TOKEN_ENCRYPTION_KEY: "1111111111111111111111111111111111111111111111111111111111111111"
    };

    mocks.getHostedGraphSvg.mockResolvedValue({
      svg: "<svg><title>ok</title></svg>",
      source: "cache",
      date: "2026-02-22"
    });

    const req = createMockRequest({
      query: {
        github: " WestonBDev.svg ",
        theme: "light"
      }
    });
    const { res, capture } = createMockResponse();

    await handler(req, res);

    expect(mocks.getHostedGraphSvg).toHaveBeenCalledTimes(1);
    expect(mocks.getHostedGraphSvg).toHaveBeenCalledWith({
      githubLogin: "WestonBDev",
      theme: "light",
      store: { marker: "store" },
      stravaClientId: "204011",
      stravaClientSecret: "client-secret",
      tokenEncryptionKey: "1111111111111111111111111111111111111111111111111111111111111111"
    });

    expect(capture.statusCode).toBe(200);
    expect(capture.headers["content-type"]).toBe("image/svg+xml; charset=utf-8");
    expect(capture.headers["cache-control"]).toBe(
      "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400"
    );
    expect(capture.headers["x-git-big-source"]).toBe("cache");
    expect(capture.headers["x-fithub-source"]).toBe("cache");
    expect(capture.sentBody).toBe("<svg><title>ok</title></svg>");
  });

  it("returns fallback svg when user is not connected", async () => {
    process.env = {
      ...originalEnv,
      STRAVA_CLIENT_ID: "204011",
      STRAVA_CLIENT_SECRET: "client-secret",
      GITBIG_TOKEN_ENCRYPTION_KEY: "1111111111111111111111111111111111111111111111111111111111111111"
    };

    mocks.getHostedGraphSvg.mockRejectedValue(
      new Error("GitHub login is not connected to Strava: WestonBDev")
    );

    const req = createMockRequest({
      query: {
        github: "WestonBDev"
      }
    });
    const { res, capture } = createMockResponse();

    await handler(req, res);

    expect(capture.statusCode).toBe(200);
    expect(capture.headers["content-type"]).toBe("image/svg+xml; charset=utf-8");
    expect(capture.headers["cache-control"]).toBe("public, max-age=60, s-maxage=60");
    expect(capture.headers["x-git-big-source"]).toBe("not-connected");
    expect(capture.headers["x-fithub-source"]).toBe("not-connected");
    expect(capture.sentBody).toContain("git big not connected");
  });

  it("returns 500 for unexpected errors", async () => {
    process.env = {
      ...originalEnv,
      STRAVA_CLIENT_ID: "204011",
      STRAVA_CLIENT_SECRET: "client-secret",
      GITBIG_TOKEN_ENCRYPTION_KEY: "1111111111111111111111111111111111111111111111111111111111111111"
    };

    mocks.getHostedGraphSvg.mockRejectedValue(new Error("upstream failed"));

    const req = createMockRequest({
      query: {
        github: "WestonBDev"
      }
    });
    const { res, capture } = createMockResponse();

    await handler(req, res);

    expect(capture.statusCode).toBe(500);
    expect(capture.jsonBody).toEqual({ error: "upstream failed" });
  });
});
